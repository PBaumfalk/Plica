/**
 * Tägliche Bereinigung nach Aufbewahrungsregeln. Löscht endgültig –
 * inklusive der Dateien im Objektspeicher.
 */
import "server-only";
import { and, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { audit } from "../audit";
import { db, schema } from "../db";
import { deleteObject, listObjects } from "../storage/s3";
import { purgeForm, TRASH_DAYS } from "../forms/service";

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
  const result = { submissions: 0, forms: 0, files: 0, sessions: 0, drafts: 0, events: 0, orphanObjects: 0 };

  // 1. Antworten nach Ablauf der Aufbewahrungsfrist (Dateien zuerst)
  const expired = await db.select({ id: schema.submissions.id, ws: schema.submissions.workspaceId }).from(schema.submissions).where(and(isNotNull(schema.submissions.deleteAfter), lt(schema.submissions.deleteAfter, now)));
  if (expired.length) {
    const ids = expired.map((e) => e.id);
    result.files += await deleteFiles(inArray(schema.files.submissionId, ids));
    await db.delete(schema.submissions).where(inArray(schema.submissions.id, ids));
    result.submissions = ids.length;
    for (const ws of new Set(expired.map((e) => e.ws))) await audit({ workspaceId: ws, action: "retention.submissions_deleted", meta: { count: expired.filter((e) => e.ws === ws).length } });
  }

  // 2. Formulare nach TRASH_DAYS Tagen im Papierkorb endgültig entfernen (wie im Löschdialog angekündigt)
  const formCutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000);
  const oldForms = await db.select({ id: schema.forms.id }).from(schema.forms).where(and(isNotNull(schema.forms.deletedAt), lt(schema.forms.deletedAt, formCutoff)));
  for (const f of oldForms) {
    const r = await purgeForm(null, null, f.id);
    result.forms++;
    result.files += r.files;
    result.submissions += r.submissions;
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

  // 6. Objekte ohne Dateizeile (Absturz zwischen Upload und Speichern) nach 24 h entfernen
  result.orphanObjects = await sweepOrphanObjects(orphanCutoff);

  // 7. Erledigte Jobs nach 30 Tagen aufräumen
  await db.delete(schema.jobs).where(and(inArray(schema.jobs.status, ["done"]), lt(schema.jobs.finishedAt, formCutoff), isNull(schema.jobs.lockedAt)));
  return result;
}

async function sweepOrphanObjects(olderThan: Date): Promise<number> {
  let removed = 0;
  let batch: { key: string; id: string }[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const known = new Set((await db.select({ id: schema.files.id }).from(schema.files).where(inArray(schema.files.id, batch.map((b) => b.id)))).map((r) => r.id));
    for (const b of batch) {
      if (known.has(b.id)) continue;
      try {
        await deleteObject(b.key);
        removed++;
      } catch {
        /* nächster Lauf */
      }
    }
    batch = [];
  };
  try {
    for await (const o of listObjects("ws/")) {
      const id = o.key.split("/")[2];
      if (!id || o.lastModified >= olderThan) continue;
      batch.push({ key: o.key, id });
      if (batch.length >= 500) await flush();
    }
    await flush();
  } catch {
    /* Speicher nicht erreichbar – nächster Lauf */
  }
  return removed;
}
