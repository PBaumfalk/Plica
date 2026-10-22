/**
 * Vorausgefüllte Folgeformulare. Der Link enthält nur ein signiertes
 * Token (Ziel-Formular + Quell-Antwort), keine Antwortdaten – die Werte
 * werden beim Öffnen serverseitig aus der Antwort übernommen.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { fieldIndex, type Field, type FormDefinition } from "@/lib/forms/schema";
import { db, schema } from "../db";
import { signPayload, verifyPayload } from "../lib/crypto";

const TTL = 30 * 86_400;
/** Diese Typen werden nie übernommen: Einwilligung und Unterschrift müssen neu erklärt werden. */
const NEVER = new Set(["consent", "signature", "file", "calculated", "heading", "paragraph", "divider", "image"]);
const TEXTISH = new Set(["short_text", "long_text", "email", "phone", "hidden"]);

function compatible(a: Field, b: Field) {
  if (a.type === b.type) return true;
  return TEXTISH.has(a.type) && TEXTISH.has(b.type);
}

export function createPrefillToken(targetFormId: string, submissionId: string) {
  return signPayload({ t: targetFormId, s: submissionId }, "prefill", TTL);
}

/** Werte für das Ziel-Formular; nur innerhalb desselben Workspace. */
export async function resolvePrefill(token: string, target: { id: string; workspaceId: string; definition: FormDefinition }) {
  const p = verifyPayload<{ t: string; s: string }>(token, "prefill");
  if (!p || p.t !== target.id) return null;
  const sub = await db.query.submissions.findFirst({ where: and(eq(schema.submissions.id, p.s), eq(schema.submissions.workspaceId, target.workspaceId)) });
  if (!sub) return null;
  const version = await db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, sub.versionId) });
  if (!version) return null;
  const sourceByKey = new Map([...fieldIndex(version.definition).values()].filter((e) => !e.parent).map((e) => [e.field.key, e.field]));
  const answers: Record<string, unknown> = {};
  for (const { field, parent } of fieldIndex(target.definition).values()) {
    if (parent || NEVER.has(field.type)) continue;
    const src = sourceByKey.get(field.key);
    if (!src || !compatible(src, field)) continue;
    const v = sub.data[src.id];
    if (v === undefined || v === null) continue;
    answers[field.id] = v;
  }
  return { answers, submissionId: sub.id };
}
