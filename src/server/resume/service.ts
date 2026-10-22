/**
 * Sichere Fortsetzungslinks. Der Zwischenstand liegt AES-GCM-verschlüsselt
 * in der Datenbank, gespeichert wird nur der Hash des Tokens. Wer den Link
 * kennt, kann weitermachen – deshalb lange Zufallstokens und 30 Tage Ablauf.
 */
import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { fieldIndex, isInputField, type FormDefinition } from "@/lib/forms/schema";
import { db, schema } from "../db";
import { decrypt, encrypt, randomToken, sha256 } from "../lib/crypto";
import { loadPublicForm, readFormToken } from "../submissions/submit";

export const RESUME_DAYS = 30;
const MAX_JSON = 1_200_000;

type Stored = { answers: Record<string, unknown>; pageId?: string; startedAt?: number };

/** Nur bekannte Eingabefelder übernehmen – unbekannte Schlüssel verwerfen. */
export function sanitizeAnswers(def: FormDefinition, raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const { field, parent } of fieldIndex(def).values()) {
    if (parent || !isInputField(field) || field.type === "calculated") continue;
    if (field.id in src && src[field.id] !== undefined) out[field.id] = src[field.id];
  }
  return out;
}

export type SaveResult = { ok: true; token: string; expiresAt: Date } | { ok: false; status: number; error: string };

export async function saveResume(slug: string, input: { token?: unknown; answers?: unknown; pageId?: unknown; resume?: unknown }): Promise<SaveResult> {
  const loaded = await loadPublicForm(slug);
  if (!loaded) return { ok: false, status: 410, error: "Dieses Formular ist nicht verfügbar." };
  if (loaded.closed) return { ok: false, status: 410, error: loaded.closed };
  if (!loaded.definition.settings.allowResume) return { ok: false, status: 403, error: "Für dieses Formular ist das Fortsetzen nicht aktiviert." };
  const tok = readFormToken(String(input.token ?? ""), loaded.form.id);
  if (!tok) return { ok: false, status: 403, error: "Die Sitzung ist abgelaufen. Bitte laden Sie die Seite neu." };

  const answers = sanitizeAnswers(loaded.definition, input.answers);
  const pageId = typeof input.pageId === "string" && loaded.definition.pages.some((p) => p.id === input.pageId) ? input.pageId : undefined;
  // Ursprünglicher Beginn bleibt erhalten (Spam-Schutz misst die Ausfülldauer)
  const json = JSON.stringify({ answers, pageId, startedAt: tok.t } satisfies Stored);
  if (json.length > MAX_JSON) return { ok: false, status: 413, error: "Der Zwischenstand ist zu groß." };
  const data = encrypt(json, "resume");
  const expiresAt = new Date(Date.now() + RESUME_DAYS * 86_400_000);

  // Vorhandenen Link aktualisieren statt immer neue zu erzeugen
  if (typeof input.resume === "string" && /^[A-Za-z0-9_-]{30,80}$/.test(input.resume)) {
    const updated = await db
      .update(schema.resumeDrafts)
      .set({ data, pageId, versionId: loaded.version.id, expiresAt, updatedAt: new Date() })
      .where(and(eq(schema.resumeDrafts.tokenHash, sha256(input.resume)), eq(schema.resumeDrafts.formId, loaded.form.id)))
      .returning({ id: schema.resumeDrafts.id });
    if (updated.length) return { ok: true, token: input.resume, expiresAt };
  }
  const token = randomToken(32);
  await db.insert(schema.resumeDrafts).values({ formId: loaded.form.id, versionId: loaded.version.id, tokenHash: sha256(token), data, pageId, uploadSession: tok.u, expiresAt });
  return { ok: true, token, expiresAt };
}

export async function loadResume(token: string) {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return null;
  const row = await db.query.resumeDrafts.findFirst({ where: and(eq(schema.resumeDrafts.tokenHash, sha256(token)), gt(schema.resumeDrafts.expiresAt, new Date())) });
  if (!row) return null;
  const form = await db.query.forms.findFirst({ where: eq(schema.forms.id, row.formId), columns: { slug: true } });
  if (!form) return null;
  const loaded = await loadPublicForm(form.slug);
  if (!loaded) return null;
  let stored: Stored;
  try {
    stored = JSON.parse(decrypt(row.data, "resume")) as Stored;
  } catch {
    return null;
  }
  // In die aktuell veröffentlichte Version übertragen (Zuordnung über Feld-IDs)
  const answers = sanitizeAnswers(loaded.definition, stored.answers);
  const pageId = loaded.definition.pages.some((p) => p.id === stored.pageId) ? stored.pageId : undefined;
  return { loaded, answers, pageId, uploadSession: row.uploadSession, expiresAt: row.expiresAt, startedAt: typeof stored.startedAt === "number" ? stored.startedAt : row.updatedAt.getTime() };
}

export async function deleteResume(slug: string, token: string) {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return;
  const loaded = await loadPublicForm(slug);
  if (!loaded) return;
  await db.delete(schema.resumeDrafts).where(and(eq(schema.resumeDrafts.tokenHash, sha256(token)), eq(schema.resumeDrafts.formId, loaded.form.id)));
}
