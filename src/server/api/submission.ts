import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { ApiError, isUuid } from "./auth";

/** Antwort nur innerhalb des eigenen Workspace – sonst 404 (keine Existenz verraten). */
export async function loadSubmission(workspaceId: string, id: string) {
  if (!isUuid(id)) throw new ApiError(404, "not_found", "Antwort nicht gefunden.");
  const sub = await db.query.submissions.findFirst({ where: and(eq(schema.submissions.id, id), eq(schema.submissions.workspaceId, workspaceId)) });
  if (!sub) throw new ApiError(404, "not_found", "Antwort nicht gefunden.");
  const version = (await db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, sub.versionId) }))!;
  return { sub, version };
}
