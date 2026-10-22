import { and, eq, isNull } from "drizzle-orm";
import { ApiError, apiHandler, isUuid, ok, require } from "@/server/api/auth";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";

export const GET = apiHandler(async (_req, p, ctx: RouteContext<"/api/v1/forms/[id]">) => {
  require(p, "forms.read");
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError(404, "not_found", "Formular nicht gefunden.");
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.id, id), eq(schema.forms.workspaceId, p.workspaceId), isNull(schema.forms.deletedAt)) });
  if (!form) throw new ApiError(404, "not_found", "Formular nicht gefunden.");
  const version = form.publishedVersionId ? await db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, form.publishedVersionId) }) : null;
  return ok({
    id: form.id,
    slug: form.slug,
    status: form.status,
    title: form.draft.title,
    publicUrl: version ? `${config().publicUrl}/f/${form.slug}` : null,
    submissionCount: form.submissionCount,
    published: version ? { version: version.number, publishedAt: version.publishedAt.toISOString(), definition: version.definition } : null,
  });
});
