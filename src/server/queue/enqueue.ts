/**
 * Dauerhafte Job-Queue in PostgreSQL.
 * Ein Idempotenzschlüssel verhindert doppelte Jobs für dasselbe Ereignis.
 * pg_notify weckt den Worker sofort (Zustellung erst beim Commit).
 */
import "server-only";
import { sql } from "drizzle-orm";
import { db, schema, type Tx } from "../db";

export type JobType = "workflow.run" | "notify.submission" | "retention.sweep";

export const JOB_CHANNEL = "plica_jobs";

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { idempotencyKey?: string; runAt?: Date; maxAttempts?: number; tx?: Tx } = {},
) {
  const runner = opts.tx ?? db;
  await runner
    .insert(schema.jobs)
    .values({ type, payload, idempotencyKey: opts.idempotencyKey, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 6 })
    .onConflictDoNothing({ target: schema.jobs.idempotencyKey });
  await runner.execute(sql`select pg_notify(${JOB_CHANNEL}, ${type})`);
}
