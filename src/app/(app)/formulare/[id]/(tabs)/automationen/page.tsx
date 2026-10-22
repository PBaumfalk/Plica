import { and, desc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { getForm } from "@/server/forms/service";
import { mailConfigured } from "@/server/mail/mailer";
import { listRuns } from "@/server/workflows/runs";
import { fieldIndex, isInputField } from "@/lib/forms/schema";
import { DeliveryProblems } from "@/components/automations/delivery-problems";
import { listProblems } from "@/server/queue/problems";
import { AutomationsView, type FieldOption } from "@/components/automations/automations-view";

export const metadata = { title: "Automationen" };

export default async function AutomationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer("forms.read");
  const form = await getForm(v.workspace.id, id);
  const flows = await db.query.workflows.findMany({ where: and(eq(schema.workflows.formId, form.id), eq(schema.workflows.workspaceId, v.workspace.id)), orderBy: (w, { asc }) => asc(w.createdAt) });
  const lastRuns = await db
    .select({ workflowId: schema.workflowRuns.workflowId, status: schema.workflowRuns.status, createdAt: schema.workflowRuns.createdAt })
    .from(schema.workflowRuns)
    .innerJoin(schema.workflows, eq(schema.workflows.id, schema.workflowRuns.workflowId))
    .where(eq(schema.workflows.formId, form.id))
    .orderBy(desc(schema.workflowRuns.createdAt))
    .limit(200);
  const latest = new Map<string, { status: string; at: string }>();
  for (const r of lastRuns) if (!latest.has(r.workflowId)) latest.set(r.workflowId, { status: r.status, at: r.createdAt.toISOString() });

  const fields: FieldOption[] = [];
  for (const { field, parent } of fieldIndex(form.draft).values()) {
    if (parent || !isInputField(field) || field.type === "group" || field.type === "file" || field.type === "signature") continue;
    fields.push({ id: field.id, key: field.key, label: field.label || field.key, type: field.type, options: field.options?.map((o) => ({ value: o.value, label: o.label })) });
  }
  const submissionCount = await db.$count(schema.submissions, eq(schema.submissions.formId, form.id));

  const problems = await listProblems(v.workspace.id, form.id);
  return (
    <>
    <DeliveryProblems canRetry={can(v.role, "workflows.write")} items={problems.map((p) => ({ ...p, finishedAt: p.finishedAt?.toISOString() ?? null }))} />
    <AutomationsView
      formId={form.id}
      fields={fields}
      canWrite={can(v.role, "workflows.write")}
      mailReady={mailConfigured()}
      allowPrivateWebhooks={config().WEBHOOK_ALLOW_PRIVATE}
      hasSubmissions={submissionCount > 0}
      runs={await listRuns(v.workspace.id, form.id)}
      workflows={flows.map((w) => ({
        id: w.id,
        name: w.name,
        enabled: w.enabled,
        trigger: w.trigger,
        triggerStatus: (w.triggerStatus as never) ?? null,
        condition: w.condition,
        steps: w.steps,
        elseSteps: w.elseSteps,
        lastRun: latest.get(w.id) ?? null,
      }))}
    />
    </>
  );
}
