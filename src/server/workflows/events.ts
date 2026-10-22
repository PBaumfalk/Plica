/**
 * Fachliche Ereignisse, die Workflows auslösen. Statuswechsel immer über
 * emitStatusChanged – egal ob aus der Oberfläche, der API oder einem Workflow.
 */
import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "../db";
import type { SubmissionStatus } from "../db/schema";
import { enqueue } from "../queue/enqueue";

/** Mehr als drei verkettete Statuswechsel durch Workflows deuten auf eine Schleife hin. */
export const MAX_WORKFLOW_DEPTH = 3;

export async function emitStatusChanged(e: { submissionId: string; from: string; to: SubmissionStatus; userId: string | null; depth?: number; source?: "ui" | "api" | "workflow" | "approval" }): Promise<boolean> {
  const depth = e.depth ?? 0;
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.submissions)
      .set({ status: e.to, updatedAt: new Date() })
      .where(and(eq(schema.submissions.id, e.submissionId), ne(schema.submissions.status, e.to)))
      .returning({ id: schema.submissions.id });
    if (updated.length === 0) return false;
    const [ev] = await tx
      .insert(schema.submissionEvents)
      .values({ submissionId: e.submissionId, userId: e.userId, type: "status_changed", data: { from: e.from, to: e.to, source: e.source ?? "ui" } })
      .returning({ id: schema.submissionEvents.id });
    if (depth <= MAX_WORKFLOW_DEPTH) {
      await enqueue("workflow.run", { trigger: "submission.status_changed", submissionId: e.submissionId, status: e.to, depth }, { idempotencyKey: `sub:${e.submissionId}:status:${ev.id}`, tx });
    }
    return true;
  });
}
