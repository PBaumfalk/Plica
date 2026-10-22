import "server-only";
import { db, schema } from "./db";

/** Audit-Ereignis schreiben. Niemals Passwörter, Tokens oder Antwortinhalte in meta. */
export async function audit(e: { workspaceId?: string | null; userId?: string | null; action: string; targetType?: string; targetId?: string; meta?: Record<string, unknown> }) {
  await db.insert(schema.auditLog).values({
    workspaceId: e.workspaceId ?? null,
    userId: e.userId ?? null,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    meta: e.meta ?? {},
  });
}
