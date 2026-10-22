/**
 * Geschützter Datei-Download. Nur angemeldete Mitglieder des Workspace mit
 * Leserecht auf Antworten. Ungeprüfte Dateien (Quarantäne) erst nach
 * ausdrücklicher Freigabe; infizierte nie.
 */
import { and, eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { AuthError, assertViewer } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { contentDisposition } from "@/server/lib/download";
import { problem } from "@/server/lib/http";
import { getObject } from "@/server/storage/s3";

const INLINE_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) return problem(404, "Datei nicht gefunden.");
  try {
    const v = await assertViewer("submissions.read");
    const file = await db.query.files.findFirst({ where: and(eq(schema.files.id, id), eq(schema.files.workspaceId, v.workspace.id)) });
    // Nur Dateien, die zu einer Antwort gehören (keine halbfertigen Uploads)
    if (!file || !file.submissionId || file.kind === "asset") return problem(404, "Datei nicht gefunden.");
    if (file.status === "infected") return problem(403, "Diese Datei wurde als schädlich erkannt und ist gesperrt.");
    const released = file.status === "clean" || !!(file.meta as { releasedAt?: string }).releasedAt;
    if (!released) return problem(409, "Diese Datei wurde nicht auf Viren geprüft und liegt in Quarantäne. Eine berechtigte Person muss sie zuerst freigeben.", { quarantined: true });

    const inline = new URL(req.url).searchParams.get("inline") === "1" && INLINE_OK.has(file.mime);
    const body = await getObject(file.storageKey);
    if (!inline) await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "file.downloaded", targetType: "file", targetId: file.id, meta: { submissionId: file.submissionId } });
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": file.mime,
        "content-length": String(body.length),
        "content-disposition": contentDisposition(file.name, inline),
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
        // PDFs brauchen den eingebauten Betrachter; alles andere läuft in einer Sandbox
        "content-security-policy": file.mime === "application/pdf" && inline ? "default-src 'none'; frame-ancestors 'self'" : "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    throw e;
  }
}
