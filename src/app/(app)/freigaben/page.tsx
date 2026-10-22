import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireViewer } from "@/server/auth/session";
import { can, ROLE_RANK } from "@/server/auth/rbac";
import { db, schema } from "@/server/db";
import { answerRows } from "@/lib/forms/format";
import type { FormDefinition } from "@/lib/forms/schema";
import { ApprovalsView } from "@/components/automations/approvals-view";
import type { Role } from "@/server/db/schema";

export const metadata = { title: "Freigaben" };

export default async function ApprovalsPage() {
  const v = await requireViewer("submissions.read");
  const decider = alias(schema.users, "decider");
  const rows = await db
    .select({
      a: schema.approvals,
      number: schema.submissions.number,
      submittedAt: schema.submissions.submittedAt,
      data: schema.submissions.data,
      formId: schema.submissions.formId,
      definition: schema.formVersions.definition,
      deciderName: decider.name,
    })
    .from(schema.approvals)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.approvals.submissionId))
    .innerJoin(schema.formVersions, eq(schema.formVersions.id, schema.submissions.versionId))
    .leftJoin(decider, eq(decider.id, schema.approvals.decidedBy))
    .where(and(eq(schema.approvals.workspaceId, v.workspace.id), inArray(schema.approvals.status, ["pending", "approved", "rejected"])))
    .orderBy(desc(schema.approvals.createdAt))
    .limit(200);
  const canDecide = can(v.role, "approvals.decide");
  return (
    <ApprovalsView
      items={rows.map((r) => {
        const def = r.definition as FormDefinition;
        return {
          id: r.a.id,
          title: r.a.title,
          status: r.a.status,
          comment: r.a.comment,
          createdAt: r.a.createdAt.toISOString(),
          decidedAt: r.a.decidedAt?.toISOString() ?? null,
          deciderName: r.deciderName,
          assigneeRole: r.a.assigneeRole,
          mayDecide: canDecide && ROLE_RANK[v.role] >= ROLE_RANK[r.a.assigneeRole as Role],
          formId: r.formId,
          submissionId: r.a.submissionId,
          formTitle: def.title,
          number: r.number,
          summary: answerRows(def, r.data).slice(0, 8).map((x) => ({ label: x.label, text: x.text })),
        };
      })}
    />
  );
}
