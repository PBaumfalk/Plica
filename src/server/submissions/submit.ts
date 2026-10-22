/**
 * Öffentliche Einreichung. Alles hier verarbeitet nicht vertrauenswürdige
 * Eingaben: Die veröffentlichte Version ist maßgeblich, nie der Client.
 */
import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { answerRows } from "@/lib/forms/format";
import { fieldIndex, type FormDefinition } from "@/lib/forms/schema";
import { SIGNATURE_MAX_BYTES, validateSubmission, type FileRef } from "@/lib/forms/validate";
import { db, schema } from "../db";
import { sha256, shortId, signPayload, verifyPayload } from "../lib/crypto";
import { enqueue } from "../queue/enqueue";
import { putObject, storageKey } from "../storage/s3";
import { closedReason } from "../forms/service";

export const MIN_FILL_MS = 2500;

export async function loadPublicForm(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.slug, slug), isNull(schema.forms.deletedAt)) });
  if (!form || !form.publishedVersionId || form.status === "draft") return null;
  const version = await db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, form.publishedVersionId) });
  if (!version) return null;
  return { form, version, definition: version.definition as FormDefinition, closed: closedReason(form) };
}

/** Beim Ausliefern des Formulars: signiertes Token mit Ladezeit (gegen Bots). */
export function issueFormToken(formId: string, uploadSession: string) {
  return signPayload({ f: formId, t: Date.now(), u: uploadSession }, "form", 24 * 3600);
}

export function readFormToken(token: string, formId: string) {
  const p = verifyPayload<{ f: string; t: number; u: string }>(token, "form");
  if (!p || p.f !== formId) return null;
  return p;
}

export interface SubmitInput {
  answers: Record<string, unknown>;
  token: string;
  clientKey: string;
  honeypot?: string;
  meta?: { durationMs?: number; embedded?: boolean; referrer?: string; prefill?: string };
}

export type SubmitResult =
  | { ok: true; submissionId: string; number: number; endingId: string; duplicate?: boolean }
  | { ok: false; status: 400 | 403 | 409 | 410 | 422; error: string; errors?: Record<string, string> };

function retentionDate(days: number | null | undefined) {
  return days ? new Date(Date.now() + days * 86_400_000) : null;
}

export async function submit(slug: string, input: SubmitInput, ctx: { userAgent?: string | null; ipHash: string }): Promise<SubmitResult> {
  const loaded = await loadPublicForm(slug);
  if (!loaded) return { ok: false, status: 410, error: "Dieses Formular ist nicht verfügbar." };
  const { form, version, definition } = loaded;
  if (loaded.closed) return { ok: false, status: 410, error: loaded.closed };

  const token = readFormToken(input.token, form.id);
  if (!token) return { ok: false, status: 403, error: "Die Sitzung ist abgelaufen. Bitte laden Sie die Seite neu." };
  if (typeof input.clientKey !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(input.clientKey)) return { ok: false, status: 400, error: "Ungültige Anfrage." };

  // Idempotenz: dieselbe Einreichung zweimal gesendet (Doppelklick, Netzabbruch)
  const existing = await db.query.submissions.findFirst({ where: and(eq(schema.submissions.formId, form.id), eq(schema.submissions.clientKey, input.clientKey)) });
  if (existing) return { ok: true, submissionId: existing.id, number: existing.number, endingId: existing.endingId ?? definition.endings[0].id, duplicate: true };

  const result = validateSubmission(definition, input.answers ?? {});
  if (!result.ok) return { ok: false, status: 422, error: "Bitte prüfen Sie die markierten Angaben.", errors: result.errors };

  // Spam: Honeypot ausgefüllt oder unrealistisch schnell → still verwerfen.
  const tooFast = Date.now() - token.t < MIN_FILL_MS;
  if ((input.honeypot && input.honeypot.length > 0) || tooFast) {
    return { ok: true, submissionId: "00000000-0000-0000-0000-000000000000", number: 0, endingId: result.state.ending.id };
  }

  const index = fieldIndex(definition);
  const values = result.values;

  // Datei-Referenzen gegen die Upload-Sitzung prüfen – nur eigene, unverbrauchte Dateien.
  const fileIds: string[] = [];
  for (const [fid, v] of Object.entries(values)) {
    const f = index.get(fid)?.field;
    if (f?.type === "file") for (const ref of v as FileRef[]) fileIds.push(ref.id);
  }
  let fileRows: (typeof schema.files.$inferSelect)[] = [];
  if (fileIds.length) {
    fileRows = await db.query.files.findMany({
      where: and(inArray(schema.files.id, fileIds), eq(schema.files.formId, form.id), eq(schema.files.uploadSession, token.u), isNull(schema.files.submissionId)),
    });
    if (fileRows.length !== new Set(fileIds).size) return { ok: false, status: 422, error: "Eine hochgeladene Datei ist nicht mehr verfügbar. Bitte laden Sie sie erneut hoch." };
    if (fileRows.some((r) => r.status === "infected")) return { ok: false, status: 422, error: "Eine Datei wurde als schädlich erkannt und abgelehnt." };
    // Metadaten vom Server übernehmen, nicht vom Client
    const byId = new Map(fileRows.map((r) => [r.id, r]));
    for (const [fid, v] of Object.entries(values)) {
      if (index.get(fid)?.field.type !== "file") continue;
      values[fid] = (v as FileRef[]).map((ref) => {
        const row = byId.get(ref.id)!;
        return { id: row.id, name: row.name, size: row.size, type: row.mime };
      });
    }
  }

  // Unterschriften als Dateien mit Nachweisdaten speichern
  const signatureFiles: { id: string; fieldId: string; buf: Buffer; hash: string }[] = [];
  for (const [fid, v] of Object.entries(values)) {
    const f = index.get(fid)?.field;
    if (f?.type !== "signature") continue;
    const dataUrl = (v as { dataUrl?: string }).dataUrl;
    if (!dataUrl) {
      delete values[fid];
      continue;
    }
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    if (buf.length > SIGNATURE_MAX_BYTES || buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return { ok: false, status: 422, error: "Die Unterschrift konnte nicht gelesen werden.", errors: { [fid]: "Bitte erneut unterschreiben." } };
    const id = shortId(24);
    const hash = sha256(buf);
    signatureFiles.push({ id, fieldId: fid, buf, hash });
    values[fid] = { fileId: id, sha256: hash, signedAt: new Date().toISOString(), kind: "simple_electronic_signature" };
  }
  for (const s of signatureFiles) await putObject(storageKey(form.workspaceId, s.id), s.buf, "image/png");

  const rows = answerRows(definition, values);
  const searchText = rows.map((r) => r.text).join(" • ").slice(0, 20_000);
  const emailField = rows.find((r) => r.field.type === "email");
  const workspace = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, form.workspaceId), columns: { retentionDays: true } });

  const inserted = await db.transaction(async (tx) => {
    // Limit atomar prüfen und Nummer vergeben
    const [counter] = await tx
      .update(schema.forms)
      .set({ submissionCount: sql`${schema.forms.submissionCount} + 1` })
      .where(and(eq(schema.forms.id, form.id), sql`(${schema.forms.maxSubmissions} is null or ${schema.forms.submissionCount} < ${schema.forms.maxSubmissions})`))
      .returning({ n: schema.forms.submissionCount });
    if (!counter) return null;
    const [sub] = await tx
      .insert(schema.submissions)
      .values({
        workspaceId: form.workspaceId,
        formId: form.id,
        versionId: version.id,
        number: counter.n,
        data: values,
        endingId: result.state.ending.id,
        searchText,
        respondentEmail: typeof emailField?.value === "string" ? emailField.value : null,
        clientKey: input.clientKey,
        meta: {
          durationMs: typeof input.meta?.durationMs === "number" ? Math.min(Math.max(0, Math.round(input.meta.durationMs)), 7 * 86_400_000) : undefined,
          embedded: !!input.meta?.embedded,
          language: definition.settings.language,
          userAgent: ctx.userAgent?.slice(0, 300) ?? undefined,
          prefillFrom: typeof input.meta?.prefill === "string" ? input.meta.prefill.slice(0, 64) : undefined,
        },
        deleteAfter: retentionDate(form.retentionDays ?? workspace?.retentionDays),
      })
      .returning();
    if (fileRows.length) {
      await tx.update(schema.files).set({ submissionId: sub.id, uploadSession: null }).where(inArray(schema.files.id, fileRows.map((r) => r.id)));
    }
    for (const s of signatureFiles) {
      const field = index.get(s.fieldId)!.field;
      await tx.insert(schema.files).values({
        id: s.id,
        workspaceId: form.workspaceId,
        formId: form.id,
        submissionId: sub.id,
        fieldId: s.fieldId,
        kind: "signature",
        name: `unterschrift-${field.key}.png`,
        mime: "image/png",
        size: s.buf.length,
        sha256: s.hash,
        storageKey: storageKey(form.workspaceId, s.id),
        status: "clean",
        meta: {
          signedAt: new Date().toISOString(),
          ipHash: ctx.ipHash,
          userAgent: ctx.userAgent?.slice(0, 300),
          label: field.label,
          formVersion: version.number,
          type: "Einfache elektronische Signatur (eIDAS Art. 3 Nr. 10)",
        },
      });
    }
    await tx.insert(schema.submissionEvents).values({ submissionId: sub.id, type: "created", data: { version: version.number } });
    await enqueue("workflow.run", { trigger: "submission.created", submissionId: sub.id }, { idempotencyKey: `sub:${sub.id}:created`, tx });
    if (form.notifyEmails.length) await enqueue("notify.submission", { submissionId: sub.id }, { idempotencyKey: `sub:${sub.id}:notify`, tx });
    return sub;
  });
  if (!inserted) return { ok: false, status: 410, error: "Dieses Formular hat die maximale Anzahl an Antworten erreicht." };
  return { ok: true, submissionId: inserted.id, number: inserted.number, endingId: inserted.endingId ?? definition.endings[0].id };
}
