"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "../audit";
import { ROLE_RANK } from "../auth/rbac";
import { assertViewer } from "../auth/session";
import { db, schema } from "../db";
import { enqueue } from "../queue/enqueue";
import { emitStatusChanged } from "../workflows/events";
import { action, fail, ok, type ActionResult } from "./result";

const Input = z.object({ decision: z.enum(["approved", "rejected"]), comment: z.string().trim().max(2000).optional() });

export async function decideApprovalAction(approvalId: string, input: z.input<typeof Input>): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer("approvals.decide");
    const { decision, comment } = Input.parse(input);
    if (!/^[0-9a-f-]{36}$/.test(approvalId)) return fail("Freigabe nicht gefunden.");
    const a = await db.query.approvals.findFirst({ where: and(eq(schema.approvals.id, approvalId), eq(schema.approvals.workspaceId, v.workspace.id)) });
    if (!a) return fail("Freigabe nicht gefunden.");
    if (ROLE_RANK[v.role] < ROLE_RANK[a.assigneeRole]) return fail("Diese Freigabe ist einer höheren Rolle zugewiesen.");
    if (decision === "rejected" && !comment) return fail("Bitte begründe die Ablehnung kurz.", { comment: "Begründung fehlt." });
    // Nur eine Entscheidung – auch bei gleichzeitigen Klicks
    const updated = await db
      .update(schema.approvals)
      .set({ status: decision, comment: comment || null, decidedBy: v.user.id, decidedAt: new Date() })
      .where(and(eq(schema.approvals.id, a.id), eq(schema.approvals.status, "pending")))
      .returning({ id: schema.approvals.id });
    if (updated.length === 0) return fail("Über diese Freigabe wurde bereits entschieden.");
    const sub = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, a.submissionId) });
    await db.insert(schema.submissionEvents).values({ submissionId: a.submissionId, userId: v.user.id, type: decision === "approved" ? "approval_approved" : "approval_rejected", data: { approvalId: a.id, title: a.title, comment: comment || undefined } });
    if (sub) await emitStatusChanged({ submissionId: sub.id, from: sub.status, to: decision, userId: v.user.id, source: "approval" });
    await enqueue("workflow.run", { trigger: decision === "approved" ? "approval.approved" : "approval.rejected", submissionId: a.submissionId, approvalId: a.id, depth: 0 }, { idempotencyKey: `approval:${a.id}:${decision}` });
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: `approval.${decision}`, targetType: "approval", targetId: a.id });
    revalidatePath("/freigaben");
    return ok(null);
  });
}
