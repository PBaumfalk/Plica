/**
 * Dauerhafte Job-Queue in PostgreSQL.
 * Ein Idempotenzschlüssel verhindert doppelte Jobs für dasselbe Ereignis.
 */
import "server-only";
import { db, schema, type Tx } from "../db";

export type JobType = "workflow.run" | "notify.submission" | "retention.sweep" | "file.scan";

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { idempotencyKey?: string; runAt?: Date; maxAttempts?: number; tx?: Tx } = {},
) {
  const q = (opts.tx ?? db)
    .insert(schema.jobs)
    .values({ type, payload, idempotencyKey: opts.idempotencyKey, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 6 })
    .onConflictDoNothing({ target: schema.jobs.idempotencyKey });
  await q;
}
