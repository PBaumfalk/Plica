import { and, eq } from "drizzle-orm";
import { ApiError, apiHandler, require } from "@/server/api/auth";
import { audit } from "@/server/audit";
import { db, schema } from "@/server/db";
import { getObject } from "@/server/storage/s3";

export const GET = apiHandler(async (_req, p, ctx: RouteContext<"/api/v1/files/[id]">) => {
  require(p, "submissions.read");
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) throw new ApiError(404, "not_found", "Datei nicht gefunden.");
  const f = await db.query.files.findFirst({ where: and(eq(schema.files.id, id), eq(schema.files.workspaceId, p.workspaceId)) });
  if (!f || !f.submissionId) throw new ApiError(404, "not_found", "Datei nicht gefunden.");
  if (f.status === "infected") throw new ApiError(410, "file_infected", "Die Datei wurde als schädlich erkannt.");
  // Wie in der Oberfläche: geprüfte Dateien oder ungeprüfte, die eine berechtigte Person bewusst freigegeben hat
  const released = f.status === "clean" || !!(f.meta as { releasedAt?: string }).releasedAt;
  if (!released) throw new ApiError(423, "file_quarantined", "Die Datei ist ungeprüft in Quarantäne. Eine berechtigte Person muss sie in PLICA freigeben.");
  const buf = await getObject(f.storageKey);
  await audit({ workspaceId: p.workspaceId, userId: p.userId, action: "api.file_downloaded", targetType: "file", targetId: f.id, meta: { tokenId: p.tokenId } });
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": f.mime,
      "content-length": String(buf.length),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
      "cache-control": "no-store",
      "x-plica-sha256": f.sha256,
      // „unscanned“: ohne Virenprüfung von Hand freigegeben
      "x-plica-scan": f.status,
    },
  });
});
