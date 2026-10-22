/**
 * Öffentliche Auslieferung von Formular-Bildern (nur kind = 'asset').
 * Typ stammt aus der Inhaltsprüfung beim Upload, nie aus der Anfrage.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getObject } from "@/server/storage/s3";

export async function GET(_req: Request, ctx: RouteContext<"/api/public/assets/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const row = await db.query.files.findFirst({ where: and(eq(schema.files.id, id), eq(schema.files.kind, "asset")) });
  // Hochgeladen nur von angemeldeten Bearbeitern, Bildtyp per Magic Bytes geprüft;
  // als schädlich erkannte oder unfertige Dateien werden nie ausgeliefert.
  if (!row || row.status === "infected" || row.status === "pending" || !row.mime.startsWith("image/")) return new Response("Nicht gefunden", { status: 404 });
  const body = await getObject(row.storageKey);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": row.mime,
      "content-length": String(body.length),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "public, max-age=31536000, immutable",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}
