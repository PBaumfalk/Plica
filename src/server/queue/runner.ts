/**
 * Job-Verarbeitung: Anfordern mit FOR UPDATE SKIP LOCKED, Fortschritt je
 * Schritt in jobs.progress, Backoff mit Jitter, verwaiste Sperren zurückholen.
 *
 * Garantie: Ein Schritt, dessen Ergebnis in progress steht, wird nach einem
 * Absturz oder Wiederholungsversuch nie erneut ausgeführt.
 */
import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db";

export type Job = typeof schema.jobs.$inferSelect;

/** Fehler, bei dem ein erneuter Versuch sinnlos ist (z. B. 400 vom Webhook-Ziel). */
export class PermanentError extends Error {}

export interface JobContext {
  job: Job;
  /** Führt fn genau einmal aus (über Versuche hinweg) und merkt sich das Ergebnis. */
  step<T>(key: string, fn: () => Promise<T>): Promise<T>;
  done(key: string): boolean;
  get<T>(key: string): T | undefined;
  /** Letzter erlaubter Versuch? Dann Fehler protokollieren statt erneut werfen. */
  lastAttempt: boolean;
}

export const STALE_LOCK_MS = 5 * 60_000;

export async function claimJobs(workerId: string, limit: number): Promise<Job[]> {
  const rows = await db.execute(sql`
    update ${schema.jobs} set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    where id in (
      select id from ${schema.jobs}
      where status = 'queued' and run_at <= now()
      order by run_at, id
      limit ${limit}
      for update skip locked
    )
    returning id`);
  const ids = (rows as unknown as { id: number | string }[]).map((r) => Number(r.id));
  if (ids.length === 0) return [];
  return db.query.jobs.findMany({ where: (j, { inArray }) => inArray(j.id, ids) });
}

/** Jobs eines abgestürzten Workers wieder einreihen (oder aufgeben, wenn erschöpft). */
export async function recoverStale(maxAgeMs = STALE_LOCK_MS): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const dead = await db
    .update(schema.jobs)
    .set({ status: "dead", lockedAt: null, lockedBy: null, finishedAt: new Date(), lastError: "Abgebrochen und Versuche erschöpft" })
    .where(sql`${schema.jobs.status} = 'running' and ${schema.jobs.lockedAt} < ${cutoff} and ${schema.jobs.attempts} >= ${schema.jobs.maxAttempts}`)
    .returning({ id: schema.jobs.id });
  const requeued = await db
    .update(schema.jobs)
    .set({ status: "queued", lockedAt: null, lockedBy: null, runAt: new Date(), lastError: "Verarbeitung wurde unterbrochen – wird fortgesetzt" })
    .where(sql`${schema.jobs.status} = 'running' and ${schema.jobs.lockedAt} < ${cutoff}`)
    .returning({ id: schema.jobs.id });
  return dead.length + requeued.length;
}

export async function heartbeat(jobId: number) {
  await db.update(schema.jobs).set({ lockedAt: new Date() }).where(eq(schema.jobs.id, jobId));
}

export function backoffMs(attempt: number): number {
  const base = Math.min(15_000 * 2 ** Math.max(0, attempt - 1), 3600_000);
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

function errMessage(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 1000);
}

export async function runJob(job: Job, handler: (ctx: JobContext) => Promise<void>): Promise<"done" | "retry" | "dead" | "failed"> {
  const progress: Record<string, unknown> = { ...(job.progress ?? {}) };
  const ctx: JobContext = {
    job,
    lastAttempt: job.attempts >= job.maxAttempts,
    done: (k) => k in progress,
    get: <T,>(k: string) => progress[k] as T | undefined,
    async step<T>(key: string, fn: () => Promise<T>): Promise<T> {
      if (key in progress) return progress[key] as T;
      const value = await fn();
      progress[key] = value === undefined ? null : value;
      // Sofort festschreiben – das ist der Punkt, ab dem der Schritt als erledigt gilt.
      await db.execute(sql`update ${schema.jobs} set progress = progress || ${JSON.stringify({ [key]: progress[key] })}::jsonb where id = ${job.id}`);
      return value;
    },
  };
  const beat = setInterval(() => void heartbeat(job.id).catch(() => {}), 60_000);
  try {
    await handler(ctx);
    await db.update(schema.jobs).set({ status: "done", finishedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null }).where(eq(schema.jobs.id, job.id));
    return "done";
  } catch (e) {
    const msg = errMessage(e);
    if (e instanceof PermanentError) {
      await db.update(schema.jobs).set({ status: "failed", finishedAt: new Date(), lockedAt: null, lockedBy: null, lastError: msg }).where(eq(schema.jobs.id, job.id));
      return "failed";
    }
    if (job.attempts >= job.maxAttempts) {
      await db.update(schema.jobs).set({ status: "dead", finishedAt: new Date(), lockedAt: null, lockedBy: null, lastError: msg }).where(eq(schema.jobs.id, job.id));
      return "dead";
    }
    await db
      .update(schema.jobs)
      .set({ status: "queued", runAt: new Date(Date.now() + backoffMs(job.attempts)), lockedAt: null, lockedBy: null, lastError: msg })
      .where(eq(schema.jobs.id, job.id));
    return "retry";
  } finally {
    clearInterval(beat);
  }
}
