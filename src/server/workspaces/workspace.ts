/** Workspaces: anlegen, wechseln, Einstellungen, Export, Löschen. */
import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { audit } from "../audit";
import { can } from "../auth/rbac";
import { db, schema } from "../db";
import { encrypt, randomToken } from "../lib/crypto";
import { deleteObject } from "../storage/s3";
import { ServiceError, type Actor } from "./errors";

export async function listMyWorkspaces(userId: string) {
  return db
    .select({ id: schema.workspaces.id, name: schema.workspaces.name, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(asc(schema.workspaces.name));
}

export async function createWorkspace(userId: string, nameRaw: string) {
  const name = nameRaw.trim().slice(0, 120);
  if (!name) throw new ServiceError("Bitte einen Namen angeben.", "name");
  const count = await db.$count(schema.memberships, and(eq(schema.memberships.userId, userId), eq(schema.memberships.role, "owner")));
  if (count >= 25) throw new ServiceError("Du besitzt bereits 25 Workspaces.");
  const ws = await db.transaction(async (tx) => {
    const [w] = await tx.insert(schema.workspaces).values({ name, webhookSecret: encrypt(randomToken(32), "webhook") }).returning();
    await tx.insert(schema.memberships).values({ workspaceId: w.id, userId, role: "owner" });
    return w;
  });
  await audit({ workspaceId: ws.id, userId, action: "workspace.created" });
  return ws;
}

/** Wechsel nur in Workspaces, in denen die Person Mitglied ist. */
export async function switchWorkspace(sessionId: string, userId: string, workspaceId: string) {
  if (!/^[0-9a-f-]{36}$/.test(workspaceId)) throw new ServiceError("Workspace nicht gefunden.");
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, userId), eq(schema.memberships.workspaceId, workspaceId)) });
  if (!m) throw new ServiceError("Workspace nicht gefunden.");
  await db.update(schema.sessions).set({ workspaceId }).where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)));
}

export async function getWorkspace(workspaceId: string) {
  return db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, workspaceId), columns: { id: true, name: true, retentionDays: true, createdAt: true } });
}

export async function updateWorkspace(actor: Actor, input: { name: string; retentionDays: number | null }) {
  if (!can(actor.role, "workspace.manage")) throw new ServiceError("Dafür fehlt dir die Berechtigung.");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new ServiceError("Bitte einen Namen angeben.", "name");
  const r = input.retentionDays;
  if (r !== null && (!Number.isInteger(r) || r < 1 || r > 36_500)) throw new ServiceError("Bitte eine Anzahl Tage zwischen 1 und 36 500 angeben.", "retentionDays");
  const before = await getWorkspace(actor.workspaceId);
  await db.update(schema.workspaces).set({ name, retentionDays: r }).where(eq(schema.workspaces.id, actor.workspaceId));
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "workspace.updated", meta: { nameChanged: before?.name !== name, retentionDays: r } });
}

/**
 * Löscht den Workspace samt Formularen, Antworten und Dateien.
 * Voraussetzung: Inhaber, Name als Bestätigung, und ein weiterer eigener
 * Workspace bleibt bestehen (niemand soll „ins Leere“ fallen).
 */
export async function deleteWorkspace(actor: Actor, confirmName: string) {
  if (actor.role !== "owner") throw new ServiceError("Nur Inhaber können einen Workspace löschen.");
  const ws = await getWorkspace(actor.workspaceId);
  if (!ws) throw new ServiceError("Workspace nicht gefunden.");
  if (confirmName.trim() !== ws.name) throw new ServiceError("Der eingegebene Name stimmt nicht überein.", "confirm");
  const others = (await listMyWorkspaces(actor.userId)).filter((w) => w.id !== ws.id);
  if (others.length === 0) throw new ServiceError("Das ist dein einziger Workspace. Lege zuerst einen anderen an, bevor du diesen löschst.");

  const files = await db.select({ key: schema.files.storageKey }).from(schema.files).where(eq(schema.files.workspaceId, ws.id));
  let failed = 0;
  for (const f of files) {
    try {
      await deleteObject(f.key);
    } catch {
      failed++;
    }
  }
  // Sitzungen anderer Mitglieder auf einen verbleibenden Workspace umstellen
  await db.execute(sql`
    update ${schema.sessions} s set workspace_id = (
      select m.workspace_id from ${schema.memberships} m where m.user_id = s.user_id and m.workspace_id <> ${ws.id} order by m.created_at limit 1
    ) where s.workspace_id = ${ws.id}`);
  await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
  // Audit ohne workspaceId-Bindung, damit der Eintrag erhalten bleibt
  await audit({ workspaceId: null, userId: actor.userId, action: "workspace.deleted", targetType: "workspace", targetId: ws.id, meta: { files: files.length, storageErrors: failed } });
  return { nextWorkspaceId: others[0].id, storageErrors: failed };
}

/** Vollständiger JSON-Export (Formulare, Versionen, Antworten, Notizen, Verlauf, Datei-Metadaten). */
export async function exportWorkspace(actor: Actor) {
  if (!can(actor.role, "workspace.manage")) throw new ServiceError("Dafür fehlt dir die Berechtigung.");
  const ws = await getWorkspace(actor.workspaceId);
  const forms = await db.select().from(schema.forms).where(eq(schema.forms.workspaceId, actor.workspaceId));
  const formIds = forms.map((f) => f.id);
  const versions = formIds.length ? await db.select().from(schema.formVersions).where(inArray(schema.formVersions.formId, formIds)) : [];
  const subs = await db.select().from(schema.submissions).where(eq(schema.submissions.workspaceId, actor.workspaceId));
  const subIds = subs.map((s) => s.id);
  const notes = subIds.length ? await db.select().from(schema.submissionNotes).where(inArray(schema.submissionNotes.submissionId, subIds)) : [];
  const events = subIds.length ? await db.select().from(schema.submissionEvents).where(inArray(schema.submissionEvents.submissionId, subIds)) : [];
  const files = await db
    .select({ id: schema.files.id, formId: schema.files.formId, submissionId: schema.files.submissionId, fieldId: schema.files.fieldId, kind: schema.files.kind, name: schema.files.name, mime: schema.files.mime, size: schema.files.size, sha256: schema.files.sha256, status: schema.files.status, createdAt: schema.files.createdAt })
    .from(schema.files)
    .where(eq(schema.files.workspaceId, actor.workspaceId));
  const members = await db
    .select({ name: schema.users.name, email: schema.users.email, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, actor.workspaceId));
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "workspace.exported", meta: { forms: forms.length, submissions: subs.length } });
  return {
    format: "plica-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: { id: ws?.id, name: ws?.name, retentionDays: ws?.retentionDays },
    members,
    forms: forms.map((f) => ({ ...f, passwordHash: f.passwordHash ? "(gesetzt)" : null })),
    versions,
    submissions: subs.map((s) => ({ ...s, notes: notes.filter((n) => n.submissionId === s.id), history: events.filter((e) => e.submissionId === s.id) })),
    files,
    note: "Dateiinhalte sind nicht enthalten. Sie lassen sich je Antwort herunterladen oder über die Sicherung des Objektspeichers wiederherstellen.",
  };
}

/* ---------------- Protokoll ---------------- */

export const AUDIT_PAGE = 50;

export async function listAudit(workspaceId: string, f: { action?: string; userId?: string; from?: string; to?: string; page?: number }) {
  const where: SQL[] = [eq(schema.auditLog.workspaceId, workspaceId)];
  if (f.action) where.push(sql`${schema.auditLog.action} like ${f.action.replace(/[%_]/g, "") + "%"}`);
  if (f.userId && /^[0-9a-f-]{36}$/.test(f.userId)) where.push(eq(schema.auditLog.userId, f.userId));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) where.push(gte(schema.auditLog.createdAt, new Date(`${f.from}T00:00:00`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) where.push(lte(schema.auditLog.createdAt, new Date(`${f.to}T23:59:59.999`)));
  const page = Math.max(1, Math.min(1000, f.page ?? 1));
  const rows = await db
    .select({ id: schema.auditLog.id, action: schema.auditLog.action, targetType: schema.auditLog.targetType, targetId: schema.auditLog.targetId, meta: schema.auditLog.meta, createdAt: schema.auditLog.createdAt, userName: schema.users.name, userEmail: schema.users.email })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
    .where(and(...where))
    .orderBy(desc(schema.auditLog.createdAt), desc(schema.auditLog.id))
    .limit(AUDIT_PAGE + 1)
    .offset((page - 1) * AUDIT_PAGE);
  return { rows: rows.slice(0, AUDIT_PAGE), hasMore: rows.length > AUDIT_PAGE, page };
}

export async function auditActions(workspaceId: string) {
  const rows = await db.selectDistinct({ action: schema.auditLog.action }).from(schema.auditLog).where(eq(schema.auditLog.workspaceId, workspaceId));
  return rows.map((r) => r.action).sort();
}
