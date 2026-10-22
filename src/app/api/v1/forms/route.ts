import { and, desc, eq, isNull } from "drizzle-orm";
import { apiHandler, ok, require } from "@/server/api/auth";
import { db, schema } from "@/server/db";

export const GET = apiHandler(async (_req, p) => {
  require(p, "forms.read");
  const rows = await db
    .select({ id: schema.forms.id, slug: schema.forms.slug, status: schema.forms.status, draft: schema.forms.draft, submissionCount: schema.forms.submissionCount, updatedAt: schema.forms.updatedAt, createdAt: schema.forms.createdAt })
    .from(schema.forms)
    .where(and(eq(schema.forms.workspaceId, p.workspaceId), isNull(schema.forms.deletedAt)))
    .orderBy(desc(schema.forms.updatedAt));
  return ok({
    data: rows.map((r) => ({ id: r.id, slug: r.slug, title: r.draft.title, status: r.status, submissionCount: r.submissionCount, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
  });
});
