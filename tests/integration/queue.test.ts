/**
 * Dauerhafte Queue gegen eine echte PostgreSQL-Datenbank:
 * Wiederaufnahme nach Fehler/Absturz ohne doppelte Schritte.
 * Eigene Datenbank, damit keine anderen Tests Jobs abgreifen.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const env = {
  DATABASE_URL: process.env.QUEUE_TEST_DATABASE_URL ?? "postgres://plica:plica-dev-only@127.0.0.1:4732/plica_test_queue",
  APP_URL: "http://localhost:4700",
  SECRET_KEY: "test-only-0123456789abcdef0123456789abcdef0123456789",
  S3_ACCESS_KEY: "x",
  S3_SECRET_KEY: "x",
  PLICA_ENV: "test",
};
Object.assign(process.env, env);

type Mod = {
  runner: typeof import("@/server/queue/runner");
  enqueue: typeof import("@/server/queue/enqueue");
  db: typeof import("@/server/db");
  orm: typeof import("drizzle-orm");
};
let m: Mod;

beforeAll(async () => {
  m = {
    runner: await import("@/server/queue/runner"),
    enqueue: await import("@/server/queue/enqueue"),
    db: await import("@/server/db"),
    orm: await import("drizzle-orm"),
  };
  await m.db.db.delete(m.db.schema.jobs);
});

afterAll(async () => {
  await m.db.db.delete(m.db.schema.jobs);
});

async function job(id: number) {
  return (await m.db.db.query.jobs.findFirst({ where: m.orm.eq(m.db.schema.jobs.id, id) }))!;
}

describe("Queue", () => {
  it("dedupliziert per Idempotenzschlüssel", async () => {
    await m.enqueue.enqueue("workflow.run", { a: 1 }, { idempotencyKey: "dup-1" });
    await m.enqueue.enqueue("workflow.run", { a: 2 }, { idempotencyKey: "dup-1" });
    const rows = await m.db.db.query.jobs.findMany({ where: m.orm.eq(m.db.schema.jobs.idempotencyKey, "dup-1") });
    expect(rows).toHaveLength(1);
    await m.db.db.delete(m.db.schema.jobs);
  });

  it("wiederholt nach Fehler, ohne erledigte Schritte erneut auszuführen", async () => {
    await m.enqueue.enqueue("workflow.run", {}, { idempotencyKey: "resume-1" });
    const calls = { a: 0, b: 0 };
    let failOnce = true;
    const handler = async (ctx: import("@/server/queue/runner").JobContext) => {
      await ctx.step("a", async () => ++calls.a);
      if (failOnce) {
        failOnce = false;
        throw new Error("SMTP vorübergehend nicht erreichbar");
      }
      await ctx.step("b", async () => ++calls.b);
    };
    const [j1] = await m.runner.claimJobs("test", 5);
    expect(j1.attempts).toBe(1);
    expect(await m.runner.runJob(j1, handler)).toBe("retry");
    const after1 = await job(j1.id);
    expect(after1.status).toBe("queued");
    expect(after1.progress).toEqual({ a: 1 });
    expect(after1.runAt.getTime()).toBeGreaterThan(Date.now());
    // Backoff überspringen
    await m.db.db.update(m.db.schema.jobs).set({ runAt: new Date(0) }).where(m.orm.eq(m.db.schema.jobs.id, j1.id));
    const [j2] = await m.runner.claimJobs("test", 5);
    expect(j2.id).toBe(j1.id);
    expect(await m.runner.runJob(j2, handler)).toBe("done");
    expect(calls).toEqual({ a: 1, b: 1 });
    expect((await job(j1.id)).status).toBe("done");
  });

  it("holt Jobs eines abgestürzten Workers zurück und gibt nach maxAttempts auf", async () => {
    await m.enqueue.enqueue("workflow.run", {}, { idempotencyKey: "crash-1", maxAttempts: 2 });
    const [j] = await m.runner.claimJobs("abgestuerzt", 5);
    // Kein runJob: Prozess „stirbt“. Sperre altern lassen.
    await m.db.db.update(m.db.schema.jobs).set({ lockedAt: new Date(Date.now() - 10 * 60_000) }).where(m.orm.eq(m.db.schema.jobs.id, j.id));
    expect(await m.runner.recoverStale()).toBe(1);
    expect((await job(j.id)).status).toBe("queued");
    const [again] = await m.runner.claimJobs("neu", 5);
    expect(again.id).toBe(j.id);
    expect(again.attempts).toBe(2);
    await m.db.db.update(m.db.schema.jobs).set({ lockedAt: new Date(Date.now() - 10 * 60_000) }).where(m.orm.eq(m.db.schema.jobs.id, j.id));
    await m.runner.recoverStale();
    expect((await job(j.id)).status).toBe("dead");
  });

  it("parallele Worker bekommen nie denselben Job", async () => {
    await m.db.db.delete(m.db.schema.jobs);
    for (let i = 0; i < 20; i++) await m.enqueue.enqueue("workflow.run", { i });
    const results = await Promise.all(Array.from({ length: 5 }, (_, w) => m.runner.claimJobs(`w${w}`, 6)));
    const ids = results.flat().map((j) => j.id);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });

  it("PermanentError beendet ohne Wiederholung", async () => {
    await m.db.db.delete(m.db.schema.jobs);
    await m.enqueue.enqueue("workflow.run", {});
    const [j] = await m.runner.claimJobs("t", 1);
    expect(await m.runner.runJob(j, async () => { throw new m.runner.PermanentError("400"); })).toBe("failed");
  });
});
