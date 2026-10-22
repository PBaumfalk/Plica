/**
 * Zustellprobleme: endgültig gescheiterte Jobs (E-Mail, Webhook, Workflow) sichtbar
 * machen und erneut anstoßen. Zuordnung zum Workspace über die Antwort im Payload –
 * fremde Workspaces sehen nichts.
 */
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { audit } from "../audit";
import { db, schema } from "../db";

const TYPE_LABEL: Record<string, string> = { "notify.submission": "Benachrichtigung über neue Antwort", "workflow.run": "Automation" };

export interface DeliveryProblem {
  id: number;
  type: string;
  label: string;
  formId: string;
  formTitle: string;
  submissionNumber: number;
  lastError: string | null;
  attempts: number;
  finishedAt: Date | null;
}

export async function listProblems(workspaceId: string, formId?: string): Promise<DeliveryProblem[]> {
  const rows = await db.execute<{ id: string; type: string; form_id: string; title: string; number: number; last_error: string | null; attempts: number; finished_at: Date | null }>(sql`
    select j.id, j.type, s.form_id, f.draft->>'title' as title, s.number, j.last_error, j.attempts, j.finished_at
    from ${schema.jobs} j
    join ${schema.submissions} s on s.id = (j.payload->>'submissionId')::uuid
    join ${schema.forms} f on f.id = s.form_id
    where j.status in ('dead', 'failed')
      and j.finished_at > now() - interval '30 days'
      and j.payload ? 'submissionId'
      and (j.payload->>'submissionId') ~ '^[0-9a-f-]{36}$'
      and s.workspace_id = ${workspaceId}
      ${formId ? sql`and s.form_id = ${formId}` : sql``}
    order by j.finished_at desc
    limit 100`);
  return (rows as unknown as { id: string; type: string; form_id: string; title: string; number: number; last_error: string | null; attempts: number; finished_at: Date | null }[]).map((r) => ({
    id: Number(r.id),
    type: r.type,
    label: TYPE_LABEL[r.type] ?? r.type,
    formId: r.form_id,
    formTitle: r.title,
    submissionNumber: r.number,
    lastError: r.last_error,
    attempts: r.attempts,
    finishedAt: r.finished_at ? new Date(r.finished_at) : null,
  }));
}

/** Erneut einreihen – erledigte Teilschritte (jobs.progress) werden dabei nicht wiederholt. */
export async function retryProblem(workspaceId: string, userId: string, jobId: number): Promise<boolean> {
  const mine = (await listProblems(workspaceId)).some((p) => p.id === jobId);
  if (!mine) return false;
  await db
    .update(schema.jobs)
    .set({ status: "queued", attempts: 0, runAt: new Date(), finishedAt: null, lockedAt: null, lockedBy: null, lastError: null })
    .where(and(eq(schema.jobs.id, jobId), sql`${schema.jobs.status} in ('dead', 'failed')`));
  await db.execute(sql`select pg_notify('plica_jobs', '')`).catch(() => {});
  await audit({ workspaceId, userId, action: "job.retried", targetType: "job", targetId: String(jobId) });
  return true;
}
