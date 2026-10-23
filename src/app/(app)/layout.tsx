import { requireViewer } from "@/server/auth/session";
import { listForms } from "@/server/forms/service";
import { AppShell } from "@/components/app/app-shell";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { can } from "@/server/auth/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const forms = await listForms(v.workspace.id);
  const pendingApprovals = can(v.role, "approvals.decide")
    ? await db.$count(schema.approvals, and(eq(schema.approvals.workspaceId, v.workspace.id), eq(schema.approvals.status, "pending")))
    : 0;
  return (
    <AppShell
      user={{ name: v.user.name, email: v.user.email }}
      workspace={v.workspace.name}
      role={v.role}
      forms={forms.map((f) => ({ id: f.id, title: f.title }))}
      pendingApprovals={pendingApprovals}
      canCreate={can(v.role, "forms.write")}
      canCreateWorkspace={v.user.isInstanceAdmin}
    >
      {children}
    </AppShell>
  );
}
