import "server-only";
import { notFound } from "next/navigation";
import type { AuthedViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { cellText, unionColumns } from "@/server/export/columns";
import { NotFound } from "@/server/forms/service";
import { formTags, formVersions, listQueryToParams, listSubmissions, listViews, parseListQuery, statusCounts, assertForm } from "@/server/submissions/service";
import type { FormDefinition } from "@/lib/forms/schema";
import type { ResponsesData } from "@/components/responses/types";

export async function loadResponses(v: AuthedViewer, formId: string, sp: Record<string, string | string[] | undefined>): Promise<ResponsesData> {
  const form = await assertForm(v.workspace.id, formId).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const query = parseListQuery(sp);
  const [list, versions, counts, tags, views] = await Promise.all([
    listSubmissions(v.workspace.id, formId, query),
    formVersions(formId),
    statusCounts(v.workspace.id, formId),
    formTags(v.workspace.id, formId),
    listViews(v.workspace.id, formId, v.user.id),
  ]);
  const columns = unionColumns(versions);
  const defs = new Map(versions.map((x) => [x.id, x.definition as FormDefinition]));
  const vnum = new Map(versions.map((x) => [x.id, x.number]));
  return {
    form: { id: form.id, title: form.draft.title, slug: form.slug, published: !!form.publishedVersionId, status: form.status },
    columns: columns.map((c) => ({ fieldId: c.fieldId, label: c.label, type: c.field.type, options: c.field.options?.map((o) => ({ value: o.value, label: o.label })) })),
    rows: list.rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      tags: r.tags,
      starred: r.starred,
      submittedAt: r.submittedAt.toISOString(),
      version: vnum.get(r.versionId) ?? 0,
      email: r.respondentEmail,
      cells: Object.fromEntries(columns.map((c) => [c.fieldId, cellText(defs.get(r.versionId), c, r.data)])),
    })),
    total: list.total,
    page: list.page,
    pageSize: list.pageSize,
    query: Object.fromEntries(listQueryToParams(query)),
    counts,
    tags,
    views: views.map((x) => ({ id: x.id, name: x.name, query: x.query as Record<string, string>, shared: x.shared, mine: x.userId === v.user.id })),
    can: {
      update: can(v.role, "submissions.update"),
      delete: can(v.role, "submissions.delete"),
      export: can(v.role, "submissions.export"),
      release: can(v.role, "submissions.export"),
      share: can(v.role, "forms.publish"),
    },
  };
}
