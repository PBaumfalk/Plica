import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Builder } from "@/components/builder/builder";
import type { Field } from "@/lib/forms/schema";
import { can } from "@/server/auth/rbac";
import { requireViewer } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { getForm, getPublishedVersion, listVersions, NotFound } from "@/server/forms/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await requireViewer("forms.read");
  const form = await getForm(v.workspace.id, (await params).id).catch(() => null);
  return { title: form ? `${form.draft.title || "Formular"} bearbeiten` : "Formular" };
}

export default async function EditPage({ params }: Props) {
  const { id } = await params;
  const v = await requireViewer("forms.read");
  // Nur Bearbeiter dürfen den Editor öffnen – Leser sehen die Antworten.
  if (!can(v.role, "forms.write")) redirect(`/formulare/${id}/antworten`);
  const form = await getForm(v.workspace.id, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const [published, versions, blocks] = await Promise.all([
    getPublishedVersion(form.id, form.publishedVersionId),
    listVersions(v.workspace.id, form.id),
    db.select().from(schema.blocks).where(eq(schema.blocks.workspaceId, v.workspace.id)).orderBy(desc(schema.blocks.createdAt)),
  ]);
  return (
    <Builder
      formId={form.id}
      slug={form.slug}
      status={form.status}
      definition={form.draft}
      revision={form.draftRevision}
      published={published?.definition ?? null}
      versions={versions.map((x) => ({ id: x.id, number: x.number, publishedAt: x.publishedAt.toISOString(), publishedBy: x.publishedBy, submissions: x.submissions }))}
      blocks={blocks.map((b) => ({ id: b.id, name: b.name, description: b.description, fields: b.fields as Field[] }))}
      canPublish={can(v.role, "forms.publish")}
    />
  );
}
