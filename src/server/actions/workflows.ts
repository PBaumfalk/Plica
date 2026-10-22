"use server";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { audit } from "../audit";
import { assertViewer } from "../auth/session";
import { config } from "../config";
import { db, schema } from "../db";
import { getForm } from "../forms/service";
import { checkUrl, isPrivateAddress, SafeFetchError } from "../lib/safefetch";
import { enqueue } from "../queue/enqueue";
import { listRuns, type RunView } from "../workflows/runs";
import { WorkflowInput, type WorkflowInputT } from "../workflows/schema";
import { action, fail, ok, type ActionResult } from "./result";
import net from "node:net";

function webhookProblem(steps: WorkflowInputT["steps"]): string | null {
  for (const s of steps) {
    if (s.type !== "webhook") continue;
    try {
      const u = checkUrl(s.url);
      const host = u.hostname.replace(/^\[|\]$/g, "");
      if (!config().WEBHOOK_ALLOW_PRIVATE && (host === "localhost" || (net.isIP(host) && isPrivateAddress(host))))
        return `Webhook-Ziel „${host}“ liegt in einem internen Netz. Interne Ziele müssen in der Konfiguration erlaubt werden (WEBHOOK_ALLOW_PRIVATE).`;
    } catch (e) {
      return e instanceof SafeFetchError ? e.message : "Ungültige Webhook-Adresse.";
    }
  }
  return null;
}

async function ownWorkflow(workspaceId: string, workflowId: string) {
  if (!/^[0-9a-f-]{36}$/.test(workflowId)) return null;
  return (await db.query.workflows.findFirst({ where: and(eq(schema.workflows.id, workflowId), eq(schema.workflows.workspaceId, workspaceId)) })) ?? null;
}

export async function saveWorkflowAction(formId: string, workflowId: string | null, input: WorkflowInputT): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const v = await assertViewer("workflows.write");
    await getForm(v.workspace.id, formId);
    const data = WorkflowInput.parse(input);
    const problem = webhookProblem([...data.steps, ...data.elseSteps]);
    if (problem) return fail(problem);
    if (data.steps.length + data.elseSteps.length === 0) return fail("Bitte mindestens einen Schritt hinzufügen.");
    const values = { ...data, triggerStatus: data.trigger === "submission.status_changed" ? data.triggerStatus : null, updatedAt: new Date() };
    let id = workflowId;
    if (id) {
      const existing = await ownWorkflow(v.workspace.id, id);
      if (!existing || existing.formId !== formId) return fail("Automation nicht gefunden.");
      await db.update(schema.workflows).set(values).where(eq(schema.workflows.id, id));
    } else {
      const [row] = await db.insert(schema.workflows).values({ ...values, workspaceId: v.workspace.id, formId }).returning({ id: schema.workflows.id });
      id = row.id;
    }
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: workflowId ? "workflow.updated" : "workflow.created", targetType: "workflow", targetId: id });
    revalidatePath(`/formulare/${formId}/automationen`);
    return ok({ id: id! });
  });
}

export async function toggleWorkflowAction(workflowId: string, enabled: boolean): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer("workflows.write");
    const wf = await ownWorkflow(v.workspace.id, workflowId);
    if (!wf) return fail("Automation nicht gefunden.");
    await db.update(schema.workflows).set({ enabled, updatedAt: new Date() }).where(eq(schema.workflows.id, wf.id));
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: enabled ? "workflow.enabled" : "workflow.disabled", targetType: "workflow", targetId: wf.id });
    revalidatePath(`/formulare/${wf.formId}/automationen`);
    return ok(null);
  });
}

export async function deleteWorkflowAction(workflowId: string): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer("workflows.write");
    const wf = await ownWorkflow(v.workspace.id, workflowId);
    if (!wf) return fail("Automation nicht gefunden.");
    await db.delete(schema.workflows).where(eq(schema.workflows.id, wf.id));
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "workflow.deleted", targetType: "workflow", targetId: wf.id, meta: { name: wf.name } });
    revalidatePath(`/formulare/${wf.formId}/automationen`);
    return ok(null);
  });
}

/** Echter Testlauf mit der neuesten Antwort – wird vom Worker ausgeführt und protokolliert. */
export async function testWorkflowAction(workflowId: string): Promise<ActionResult<{ submissionNumber: number }>> {
  return action(async () => {
    const v = await assertViewer("workflows.write");
    const wf = await ownWorkflow(v.workspace.id, workflowId);
    if (!wf) return fail("Automation nicht gefunden.");
    const latest = await db.query.submissions.findFirst({ where: eq(schema.submissions.formId, wf.formId), orderBy: desc(schema.submissions.submittedAt) });
    if (!latest) return fail("Für einen Testlauf braucht das Formular mindestens eine Antwort.");
    await enqueue(
      "workflow.run",
      { trigger: wf.trigger, submissionId: latest.id, status: wf.triggerStatus ?? latest.status, workflowId: wf.id, depth: 0, test: true },
      { idempotencyKey: `test:${wf.id}:${Date.now()}`, maxAttempts: 3 },
    );
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "workflow.test_run", targetType: "workflow", targetId: wf.id });
    return ok({ submissionNumber: latest.number });
  });
}

/** Für die Oberfläche: aktueller Stand der letzten Läufe (Polling nach Testlauf). */
export async function workflowRunsAction(formId: string): Promise<ActionResult<RunView[]>> {
  return action(async () => {
    const v = await assertViewer("forms.read");
    await getForm(v.workspace.id, formId);
    return ok(await listRuns(v.workspace.id, formId));
  });
}
