import { requireViewer } from "@/server/auth/session";
import { listForms, listTrash } from "@/server/forms/service";
import { can } from "@/server/auth/rbac";
import { FormsList } from "@/components/forms/forms-list";
import { DeliveryProblems } from "@/components/automations/delivery-problems";
import { listProblems } from "@/server/queue/problems";

export const metadata = { title: "Formulare" };

export default async function FormsPage() {
  const v = await requireViewer();
  const forms = await listForms(v.workspace.id);
  const trash = can(v.role, "forms.delete") ? await listTrash(v.workspace.id) : [];
  const problems = can(v.role, "workflows.write") ? await listProblems(v.workspace.id) : [];
  return (
    <>
      {problems.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-8">
          <DeliveryProblems canRetry showForm items={problems.map((p) => ({ ...p, finishedAt: p.finishedAt?.toISOString() ?? null }))} />
        </div>
      )}
    <FormsList
      forms={forms.map((f) => ({ id: f.id, title: f.title, slug: f.slug, status: f.status, mode: f.mode, submissions: f.liveCount, newCount: f.newCount, lastSubmissionAt: f.lastSubmissionAt ? new Date(f.lastSubmissionAt).toISOString() : null, updatedAt: f.updatedAt.toISOString() }))}
      canWrite={can(v.role, "forms.write")}
      canDelete={can(v.role, "forms.delete")}
      trash={trash.map((t) => ({ id: t.id, title: t.title, submissions: t.submissions, deletedAt: t.deletedAt.toISOString(), purgeAt: t.purgeAt.toISOString() }))}
    />
    </>
  );
}
