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
  /** Gesetzt bei fehlgeschlagenen Automationsläufen (endgültige Fehler wie HTTP 400). */
  runId?: string;
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
  // Endgültig fehlgeschlagene Automationsläufe (z. B. Webhook-Ziel antwortet 400) – Job ist „done“, der Lauf nicht
  const runs = await db.execute<{ id: string; form_id: string; title: string; number: number; name: string; status: string; created_at: Date }>(sql`
    select r.id, s.form_id, f.draft->>'title' as title, s.number, w.name, r.status, r.created_at
    from ${schema.workflowRuns} r
    join ${schema.workflows} w on w.id = r.workflow_id
    join ${schema.submissions} s on s.id = r.submission_id
    join ${schema.forms} f on f.id = s.form_id
    where r.status in ('failed', 'partial') and r.workspace_id = ${workspaceId}
      and r.created_at > now() - interval '30 days'
      and r.trigger not like 'test:%'
      and not exists (select 1 from ${schema.workflowRuns} r2 where r2.workflow_id = r.workflow_id and r2.submission_id = r.submission_id and r2.created_at > r.created_at and r2.status = 'succeeded')
      ${formId ? sql`and s.form_id = ${formId}` : sql``}
    order by r.created_at desc
    limit 50`);
  const runProblems: DeliveryProblem[] = (runs as unknown as { id: string; form_id: string; title: string; number: number; name: string; status: string; created_at: Date }[]).map((r) => ({
    id: 0,
    runId: r.id,
    type: "workflow.run",
    label: `Automation „${r.name}“ ${r.status === "partial" ? "teilweise fehlgeschlagen" : "fehlgeschlagen"}`,
    formId: r.form_id,
    formTitle: r.title,
    submissionNumber: r.number,
    lastError: null,
    attempts: 1,
    finishedAt: new Date(r.created_at),
  }));
  return [...runProblems, ...(rows as unknown as { id: string; type: string; form_id: string; title: string; number: number; last_error: string | null; attempts: number; finished_at: Date | null }[]).map((r) => ({
    id: Number(r.id),
    type: r.type,
    label: TYPE_LABEL[r.type] ?? r.type,
    formId: r.form_id,
    formTitle: r.title,
    submissionNumber: r.number,
    lastError: r.last_error,
    attempts: r.attempts,
    finishedAt: r.finished_at ? new Date(r.finished_at) : null,
  }))];
}

/** Erneut einreihen – erledigte Teilschritte (jobs.progress) werden dabei nicht wiederholt. */
export async function retryProblem(workspaceId: string, userId: string, jobId: number): Promise<boolean> {
  const mine = (await listProblems(workspaceId)).some((p) => p.id === jobId);
  if (!mine) return false;
  await db
    .update(schema.jobs)
    .set({ status: "queued", attempts: 0, runAt: sql`now()`, finishedAt: null, lockedAt: null, lockedBy: null, lastError: null })
    .where(and(eq(schema.jobs.id, jobId), sql`${schema.jobs.status} in ('dead', 'failed')`));
  await db.execute(sql`select pg_notify('plica_jobs', '')`).catch(() => {});
  await audit({ workspaceId, userId, action: "job.retried", targetType: "job", targetId: String(jobId) });
  return true;
}
