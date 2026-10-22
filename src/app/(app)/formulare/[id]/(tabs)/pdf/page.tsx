import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { db, schema } from "@/server/db";
import { NotFound } from "@/server/forms/service";
import { DEFAULT_TEMPLATE } from "@/server/pdf/template";
import { assertForm } from "@/server/submissions/service";
import { isInputField, walkFields } from "@/lib/forms/schema";
import { PdfTemplateEditor } from "@/components/responses/pdf-template-editor";

export const metadata = { title: "PDF-Vorlage" };

export default async function PdfTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer("submissions.read");
  const form = await assertForm(v.workspace.id, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const templates = await db.select().from(schema.pdfTemplates).where(and(eq(schema.pdfTemplates.formId, id), eq(schema.pdfTemplates.workspaceId, v.workspace.id))).orderBy(asc(schema.pdfTemplates.createdAt));
  const fields = [...walkFields(form.draft)].filter(({ field, parent }) => !parent && isInputField(field)).map(({ field }) => ({ key: field.key, label: field.label || field.key, type: field.type }));
  const hasSubmissions = form.submissionCount > 0;
  return (
    <PdfTemplateEditor
      formId={id}
      templates={templates.map((t) => ({ id: t.id, name: t.name, body: t.body, isDefault: t.isDefault }))}
      fields={fields}
      defaultBody={DEFAULT_TEMPLATE}
      canEdit={can(v.role, "forms.write")}
      previewSource={hasSubmissions ? "latest" : "sample"}
    />
  );
}
