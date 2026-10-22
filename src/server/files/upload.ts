/**
 * Öffentliche Datei-Uploads: Größenlimit, Typ per Inhaltsanalyse
 * (Magic Bytes, nicht Dateiendung), Bereinigung des Namens,
 * Speicherung unter zufälliger ID, Virenprüfung bzw. Quarantäne.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { fieldIndex } from "@/lib/forms/schema";
import { config } from "../config";
import { db, schema } from "../db";
import { sha256, shortId } from "../lib/crypto";
import { putObject, storageKey } from "../storage/s3";
import { scanBuffer } from "./scan";
import { loadPublicForm, readFormToken } from "../submissions/submit";

/** Was PLICA grundsätzlich annimmt – Formulare können das weiter einschränken. */
export const SAFE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
]);

export function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "datei";
  const cleaned = base.normalize("NFC").replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "datei";
}

async function detectType(buf: Buffer, claimed: string): Promise<string | null> {
  const ft = await fileTypeFromBuffer(buf);
  if (ft) {
    // ZIP-basierte Office-Formate erkennt file-type korrekt als docx/xlsx/odt
    return ft.mime;
  }
  // Reiner Text hat keine Magic Bytes: nur akzeptieren, wenn gültiges UTF-8 ohne Steuerzeichen
  if (claimed === "text/plain" || claimed === "text/csv") {
    const s = buf.toString("utf8");
    if (!s.includes("�") && !/[\u0000-\u0008\u000e-\u001f]/.test(s)) return claimed;
  }
  return null;
}

export type UploadResult = { ok: true; file: { id: string; name: string; size: number; type: string } } | { ok: false; status: number; error: string };

export async function handlePublicUpload(slug: string, form: FormData): Promise<UploadResult> {
  const loaded = await loadPublicForm(slug);
  if (!loaded || loaded.closed) return { ok: false, status: 410, error: "Dieses Formular ist nicht verfügbar." };
  const token = readFormToken(String(form.get("token") ?? ""), loaded.form.id);
  if (!token) return { ok: false, status: 403, error: "Die Sitzung ist abgelaufen. Bitte laden Sie die Seite neu." };
  const fieldId = String(form.get("fieldId") ?? "");
  const field = fieldIndex(loaded.definition).get(fieldId)?.field;
  if (!field || field.type !== "file") return { ok: false, status: 400, error: "Ungültiges Feld." };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, status: 400, error: "Keine Datei erhalten." };

  const limit = Math.min((field.maxFileSizeMb ?? 10) * 1024 * 1024, config().UPLOAD_MAX_MB * 1024 * 1024);
  if (file.size > limit || file.size === 0) return { ok: false, status: 413, error: file.size === 0 ? "Die Datei ist leer." : `Die Datei ist größer als ${Math.round(limit / 1024 / 1024)} MB.` };

  // Uploads pro Sitzung begrenzen (Missbrauch als Speicher)
  const perSession = await db.$count(schema.files, eq(schema.files.uploadSession, token.u));
  if (perSession >= 40) return { ok: false, status: 429, error: "Zu viele Dateien in dieser Sitzung." };

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = await detectType(buf, file.type);
  const allowed = field.accept?.length ? new Set(field.accept.filter((a) => SAFE_TYPES.has(a))) : SAFE_TYPES;
  if (!mime || !allowed.has(mime)) return { ok: false, status: 415, error: "Dieser Dateityp ist hier nicht erlaubt." };

  const scan = await scanBuffer(buf);
  if (scan.status === "infected") return { ok: false, status: 422, error: "Die Datei wurde als schädlich erkannt und abgelehnt." };

  const id = shortId(24);
  const key = storageKey(loaded.form.workspaceId, id);
  try {
    await putObject(key, buf, mime);
  } catch {
    return { ok: false, status: 503, error: "Die Dateiablage ist vorübergehend nicht erreichbar. Bitte laden Sie die Datei in einer Minute erneut hoch – Ihre übrigen Angaben bleiben erhalten." };
  }
  const name = cleanName(file.name);
  await db.insert(schema.files).values({
    id,
    workspaceId: loaded.form.workspaceId,
    formId: loaded.form.id,
    fieldId,
    uploadSession: token.u,
    kind: "upload",
    name,
    mime,
    size: buf.length,
    sha256: sha256(buf),
    storageKey: key,
    status: scan.status,
    scanNote: scan.note,
  });
  return { ok: true, file: { id, name, size: buf.length, type: mime } };
}
