import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError, apiHandler, isUuid, ok, require } from "@/server/api/auth";
import { serializeSubmission } from "@/server/api/serialize";
import { db, schema } from "@/server/db";
import type { FormDefinition } from "@/lib/forms/schema";

const Query = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["new", "in_review", "approved", "rejected", "done", "spam"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function decodeCursor(c: string): { t: string; id: string } {
  try {
    const [t, id] = Buffer.from(c, "base64url").toString("utf8").split("|");
    if (!t || !isUuid(id) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/.test(t)) throw new Error();
    return { t, id };
  } catch {
    throw new ApiError(400, "invalid_cursor", "Ungültiger Cursor.");
  }
}

/** Älteste zuerst – ideal zum Synchronisieren: mit `since` beginnen, dann `nextCursor` folgen. */
export const GET = apiHandler(async (req, p, ctx: RouteContext<"/api/v1/forms/[id]/submissions">) => {
  require(p, "submissions.read");
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError(404, "not_found", "Formular nicht gefunden.");
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.id, id), eq(schema.forms.workspaceId, p.workspaceId), isNull(schema.forms.deletedAt)), columns: { id: true } });
  if (!form) throw new ApiError(404, "not_found", "Formular nicht gefunden.");
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const cur = q.cursor ? decodeCursor(q.cursor) : null;
  // Zeitstempel als Text in voller Mikrosekunden-Genauigkeit – JS-Dates kennen nur Millisekunden.
  const rows = await db
    .select({ s: schema.submissions, ts: sql<string>`${schema.submissions.submittedAt}::text` })
    .from(schema.submissions)
    .where(
      and(
        eq(schema.submissions.formId, form.id),
        eq(schema.submissions.workspaceId, p.workspaceId),
        q.status ? eq(schema.submissions.status, q.status) : undefined,
        q.since ? gte(schema.submissions.submittedAt, new Date(q.since)) : undefined,
        cur ? sql`(${schema.submissions.submittedAt}, ${schema.submissions.id}) > (${cur.t}::timestamptz, ${cur.id}::uuid)` : undefined,
      ),
    )
    .orderBy(asc(schema.submissions.submittedAt), asc(schema.submissions.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit).map((r) => r.s);
  const lastTs = rows[Math.min(rows.length, q.limit) - 1]?.ts;
  const versionIds = [...new Set(page.map((r) => r.versionId))];
  const versions = versionIds.length ? await db.select().from(schema.formVersions).where(inArray(schema.formVersions.id, versionIds)) : [];
  const byId = new Map(versions.map((v) => [v.id, v]));
  const last = page.at(-1);
  return ok({
    data: page.map((s) => serializeSubmission(s, byId.get(s.versionId)!.definition as FormDefinition, byId.get(s.versionId)!.number)),
    nextCursor: rows.length > q.limit && last && lastTs ? Buffer.from(`${lastTs}|${last.id}`).toString("base64url") : null,
  });
});
