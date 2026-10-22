/**
 * Bilder für Formulare (Bildblöcke, Logos) hochladen.
 * Nur angemeldete Bearbeiter; nur Rastergrafiken, per Inhaltsanalyse geprüft
 * (kein SVG – das könnte Skripte enthalten).
 */
import { fileTypeFromBuffer } from "file-type";
import { audit } from "@/server/audit";
import { assertViewer, AuthError } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { scanBuffer } from "@/server/files/scan";
import { cleanName } from "@/server/files/upload";
import { sha256, shortId } from "@/server/lib/crypto";
import { json, problem, tooLarge } from "@/server/lib/http";
import { rateLimit } from "@/server/lib/ratelimit";
import { sameOrigin } from "@/server/lib/request";
import { putObject, storageKey } from "@/server/storage/s3";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX = 5 * 1024 * 1024;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  let v;
  try {
    v = await assertViewer("forms.write");
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    throw e;
  }
  if (!rateLimit(`asset:${v.user.id}`, 30, 60_000).ok) return problem(429, "Zu viele Uploads. Bitte warte einen Moment.");
  if (tooLarge(req, MAX + 64 * 1024)) return problem(413, "Das Bild ist größer als 5 MB.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return problem(400, "Ungültige Anfrage.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return problem(400, "Keine Datei erhalten.");
  if (file.size > MAX) return problem(413, "Das Bild ist größer als 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ft = await fileTypeFromBuffer(buf);
  if (!ft || !IMAGE_TYPES.has(ft.mime)) return problem(415, "Bitte ein PNG-, JPG-, WebP- oder GIF-Bild hochladen.");
  const scan = await scanBuffer(buf);
  if (scan.status === "infected") return problem(422, "Die Datei wurde als schädlich erkannt.");
  const id = shortId(24);
  const key = storageKey(v.workspace.id, id);
  await putObject(key, buf, ft.mime);
  await db.insert(schema.files).values({
    id,
    workspaceId: v.workspace.id,
    kind: "asset",
    name: cleanName(file.name),
    mime: ft.mime,
    size: buf.length,
    sha256: sha256(buf),
    storageKey: key,
    status: scan.status,
    scanNote: scan.note,
    meta: { uploadedBy: v.user.id },
  });
  await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "asset.uploaded", targetType: "file", targetId: id });
  return json({ id, url: `/api/public/assets/${id}`, name: cleanName(file.name), type: ft.mime, size: buf.length });
}
