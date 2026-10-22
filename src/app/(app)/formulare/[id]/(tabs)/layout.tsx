import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { getForm, NotFound } from "@/server/forms/service";
import { FormHeader } from "@/components/forms/form-header";

export default async function FormTabsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer("forms.read");
  const form = await getForm(v.workspace.id, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <FormHeader id={form.id} title={form.draft.title} status={form.status} slug={form.slug} submissions={form.submissionCount} published={!!form.publishedVersionId} />
      {children}
    </div>
  );
}
