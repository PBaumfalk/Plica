import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, apiHandler, ok, require } from "@/server/api/auth";
import { serializeSubmission } from "@/server/api/serialize";
import { loadSubmission } from "@/server/api/submission";
import { audit } from "@/server/audit";
import { db, schema } from "@/server/db";
import { readJson } from "@/server/lib/http";
import { emitStatusChanged } from "@/server/workflows/events";
import type { FormDefinition } from "@/lib/forms/schema";

export const GET = apiHandler(async (_req, p, ctx: RouteContext<"/api/v1/submissions/[id]">) => {
  require(p, "submissions.read");
  const { sub, version } = await loadSubmission(p.workspaceId, (await ctx.params).id);
  const files = await db.select({ id: schema.files.id, name: schema.files.name, mime: schema.files.mime, size: schema.files.size, kind: schema.files.kind, status: schema.files.status, fieldId: schema.files.fieldId }).from(schema.files).where(eq(schema.files.submissionId, sub.id));
  return ok({ ...serializeSubmission(sub, version.definition as FormDefinition, version.number), files });
});

const Patch = z
  .object({
    status: z.enum(["new", "in_review", "approved", "rejected", "done", "spam"]).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  })
  .strict()
  // Leere Änderung ist ein Fehler des Aufrufers, kein stiller Erfolg
  .refine((d) => d.status !== undefined || d.tags !== undefined, { message: "Mindestens status oder tags angeben." });

export const PATCH = apiHandler(async (req, p, ctx: RouteContext<"/api/v1/submissions/[id]">) => {
  require(p, "submissions.update", true);
  const { sub, version } = await loadSubmission(p.workspaceId, (await ctx.params).id);
  const body = await readJson<unknown>(req, 20_000);
  if (body === null) throw new ApiError(400, "invalid_json", "Ungültiger JSON-Körper.");
  const data = Patch.parse(body);
  if (data.tags) {
    const tags = [...new Set(data.tags)];
    await db.update(schema.submissions).set({ tags, updatedAt: new Date() }).where(eq(schema.submissions.id, sub.id));
    await db.insert(schema.submissionEvents).values({ submissionId: sub.id, userId: p.userId, type: "tags_changed", data: { tags, source: "api" } });
  }
  if (data.status && data.status !== sub.status) await emitStatusChanged({ submissionId: sub.id, from: sub.status, to: data.status, userId: p.userId, source: "api" });
  await audit({ workspaceId: p.workspaceId, userId: p.userId, action: "api.submission_updated", targetType: "submission", targetId: sub.id, meta: { fields: Object.keys(data), tokenId: p.tokenId } });
  const fresh = (await db.query.submissions.findFirst({ where: eq(schema.submissions.id, sub.id) }))!;
  return ok(serializeSubmission(fresh, version.definition as FormDefinition, version.number));
});
