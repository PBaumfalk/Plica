import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";

export type RunView = { id: string; workflowId: string; status: string; branch: string | null; test: boolean; createdAt: string; finishedAt: string | null; submissionNumber: number | null; log: { at: string; step: string; ok: boolean; message: string; attempt?: number }[] };

export async function listRuns(workspaceId: string, formId: string): Promise<RunView[]> {
  const rows = await db
    .select({ run: schema.workflowRuns, number: schema.submissions.number })
    .from(schema.workflowRuns)
    .innerJoin(schema.workflows, eq(schema.workflows.id, schema.workflowRuns.workflowId))
    .leftJoin(schema.submissions, eq(schema.submissions.id, schema.workflowRuns.submissionId))
    .where(and(eq(schema.workflows.formId, formId), eq(schema.workflowRuns.workspaceId, workspaceId)))
    .orderBy(desc(schema.workflowRuns.createdAt))
    .limit(50);
  return rows.map(({ run, number }) => ({ id: run.id, workflowId: run.workflowId, status: run.status, branch: run.branch, test: run.trigger.startsWith("test:"), createdAt: run.createdAt.toISOString(), finishedAt: run.finishedAt?.toISOString() ?? null, submissionNumber: number, log: run.log }));
}
