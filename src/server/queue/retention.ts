/**
 * Tägliche Bereinigung nach Aufbewahrungsregeln. Löscht endgültig –
 * inklusive der Dateien im Objektspeicher.
 */
import "server-only";
import { and, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { audit } from "../audit";
import { db, schema } from "../db";
import { deleteObject } from "../storage/s3";

async function deleteFiles(where: SQL) {
  const rows = await db.select({ id: schema.files.id, key: schema.files.storageKey }).from(schema.files).where(where);
  for (const r of rows) {
    try {
      await deleteObject(r.key);
    } catch (e) {
      console.warn(`[retention] Objekt ${r.id} nicht gelöscht:`, e instanceof Error ? e.message : e);
    }
  }
  if (rows.length) await db.delete(schema.files).where(inArray(schema.files.id, rows.map((r) => r.id)));
  return rows.length;
}

export async function retentionSweep(now = new Date()) {
  const result = { submissions: 0, forms: 0, files: 0, sessions: 0, drafts: 0, events: 0 };

  // 1. Antworten nach Ablauf der Aufbewahrungsfrist (Dateien zuerst)
  const expired = await db.select({ id: schema.submissions.id, ws: schema.submissions.workspaceId }).from(schema.submissions).where(and(isNotNull(schema.submissions.deleteAfter), lt(schema.submissions.deleteAfter, now)));
  if (expired.length) {
    const ids = expired.map((e) => e.id);
    result.files += await deleteFiles(inArray(schema.files.submissionId, ids));
    await db.delete(schema.submissions).where(inArray(schema.submissions.id, ids));
    result.submissions = ids.length;
    for (const ws of new Set(expired.map((e) => e.ws))) await audit({ workspaceId: ws, action: "retention.submissions_deleted", meta: { count: expired.filter((e) => e.ws === ws).length } });
  }

  // 2. Gelöschte Formulare nach 30 Tagen endgültig entfernen
  const formCutoff = new Date(now.getTime() - 30 * 86_400_000);
  const oldForms = await db.select({ id: schema.forms.id, ws: schema.forms.workspaceId }).from(schema.forms).where(and(isNotNull(schema.forms.deletedAt), lt(schema.forms.deletedAt, formCutoff)));
  if (oldForms.length) {
    const ids = oldForms.map((f) => f.id);
    result.files += await deleteFiles(inArray(schema.files.formId, ids));
    // Antworten verweisen auf Versionen ohne Cascade → zuerst Antworten
    await db.delete(schema.submissions).where(inArray(schema.submissions.formId, ids));
    await db.delete(schema.forms).where(inArray(schema.forms.id, ids));
    result.forms = ids.length;
    for (const f of oldForms) await audit({ workspaceId: f.ws, action: "retention.form_purged", targetType: "form", targetId: f.id });
  }

  // 3. Abgelaufene Fortsetzungs-Entwürfe zuerst – ihre Uploads werden danach verwaist
  result.drafts = (await db.delete(schema.resumeDrafts).where(lt(schema.resumeDrafts.expiresAt, now)).returning({ id: schema.resumeDrafts.id })).length;

  // 4. Verwaiste Uploads (nie abgesendet) nach 24 Stunden – außer sie gehören zu einem
  //    noch gültigen Fortsetzungslink, sonst verlöre der Einreichende seine Dateien.
  const orphanCutoff = new Date(now.getTime() - 86_400_000);
  result.files += await deleteFiles(
    sql`${schema.files.submissionId} is null and ${schema.files.kind} = 'upload' and ${schema.files.createdAt} < ${orphanCutoff.toISOString()} and not exists (select 1 from ${schema.resumeDrafts} d where d.upload_session = ${schema.files.uploadSession})`,
  );

  // 5. Abgelaufene Sitzungen, alte Analyse-Ereignisse
  result.sessions = (await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).returning({ id: schema.sessions.id })).length;
  const eventCutoff = new Date(now.getTime() - 180 * 86_400_000);
  result.events = (await db.delete(schema.formEvents).where(lt(schema.formEvents.createdAt, eventCutoff)).returning({ id: schema.formEvents.id })).length;

  // 6. Erledigte Jobs nach 30 Tagen aufräumen
  await db.delete(schema.jobs).where(and(inArray(schema.jobs.status, ["done"]), lt(schema.jobs.finishedAt, formCutoff), isNull(schema.jobs.lockedAt)));
  return result;
}
