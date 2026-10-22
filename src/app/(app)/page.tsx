import { requireViewer } from "@/server/auth/session";
import { listForms } from "@/server/forms/service";
import { can } from "@/server/auth/rbac";
import { FormsList } from "@/components/forms/forms-list";

export const metadata = { title: "Formulare" };

export default async function FormsPage() {
  const v = await requireViewer();
  const forms = await listForms(v.workspace.id);
  return (
    <FormsList
      forms={forms.map((f) => ({ id: f.id, title: f.title, slug: f.slug, status: f.status, mode: f.mode, submissions: f.liveCount, newCount: f.newCount, lastSubmissionAt: f.lastSubmissionAt ? new Date(f.lastSubmissionAt).toISOString() : null, updatedAt: f.updatedAt.toISOString() }))}
      canWrite={can(v.role, "forms.write")}
      canDelete={can(v.role, "forms.delete")}
    />
  );
}
