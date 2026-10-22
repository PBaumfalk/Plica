import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { config } from "@/server/config";
import { getForm, getPublishedVersion } from "@/server/forms/service";
import { ShareView } from "@/components/share/share-view";

export const metadata = { title: "Teilen" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer("forms.read");
  const form = await getForm(v.workspace.id, id);
  const version = await getPublishedVersion(form.id, form.publishedVersionId);
  const draftChanged = !!version && JSON.stringify(version.definition) !== JSON.stringify(form.draft);
  return (
    <ShareView
      canPublish={can(v.role, "forms.publish")}
      publicUrl={config().publicUrl}
      embedOrigins={config().EMBED_ORIGINS}
      form={{
        id: form.id,
        slug: form.slug,
        status: form.status,
        hasPassword: !!form.passwordHash,
        opensAt: form.opensAt?.toISOString() ?? null,
        closesAt: form.closesAt?.toISOString() ?? null,
        maxSubmissions: form.maxSubmissions,
        submissionCount: form.submissionCount,
        notifyEmails: form.notifyEmails,
        retentionDays: form.retentionDays,
        title: form.draft.title,
      }}
      version={version ? { number: version.number, publishedAt: version.publishedAt.toISOString() } : null}
      draftChanged={draftChanged}
    />
  );
}
