/**
 * Nachprüfung ungeprüfter Uploads. Wenn ClamAV (wieder) erreichbar ist,
 * werden Dateien im Status „unscanned“ geprüft und auf „clean“ oder
 * „infected“ gesetzt – manuell („Jetzt prüfen“) oder stündlich durch den Worker.
 */
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { config } from "../config";
import { db, schema } from "../db";
import { getObject } from "../storage/s3";
import { scanBuffer } from "./scan";

export type RescanResult = "clean" | "infected" | "unscanned";

export async function rescanFile(fileId: string): Promise<{ status: RescanResult; note?: string }> {
  const file = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
  if (!file) throw new Error("not found");
  if (file.status !== "unscanned" && file.status !== "pending") return { status: file.status === "infected" ? "infected" : "clean" };
  const r = await scanBuffer(await getObject(file.storageKey));
  if (r.status !== "unscanned") {
    await db.update(schema.files).set({ status: r.status, scanNote: r.note ?? null }).where(eq(schema.files.id, file.id));
  } else {
    await db.update(schema.files).set({ scanNote: r.note ?? null }).where(eq(schema.files.id, file.id));
  }
  return { status: r.status, note: r.note };
}

/** Stündlicher Lauf: bis zu 200 ungeprüfte Dateien nachprüfen (nur wenn ein Scanner konfiguriert ist). */
export async function rescanPending(limit = 200): Promise<{ checked: number; clean: number; infected: number }> {
  const out = { checked: 0, clean: 0, infected: 0 };
  if (!config().CLAMAV_HOST) return out;
  const rows = await db.select({ id: schema.files.id }).from(schema.files).where(and(inArray(schema.files.status, ["unscanned", "pending"]), eq(schema.files.kind, "upload"))).limit(limit);
  for (const row of rows) {
    const r = await rescanFile(row.id).catch(() => ({ status: "unscanned" as const }));
    if (r.status === "unscanned") break; // Scanner weiterhin nicht erreichbar → nächster Lauf
    out.checked++;
    if (r.status === "clean") out.clean++;
    else out.infected++;
  }
  return out;
}
