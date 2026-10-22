/**
 * Formulare: Entwurf, Veröffentlichung, Versionen, Status.
 * Jede Funktion nimmt die workspaceId des angemeldeten Nutzers entgegen –
 * fremde IDs führen schlicht zu „nicht gefunden“ (kein IDOR).
 */
import "server-only";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { analyze, hasBlockingIssues, type Issue } from "@/lib/forms/analyze";
import { emptyDefinition, slugKey } from "@/lib/forms/fields";
import { parseDefinition, type FormDefinition } from "@/lib/forms/schema";
import { audit } from "../audit";
import { hashPassword } from "../auth/password";
import { db, schema } from "../db";
import { randomToken } from "../lib/crypto";
import { deleteObject } from "../storage/s3";

export class NotFound extends Error {
  constructor(what = "Formular") {
    super(`${what} nicht gefunden.`);
  }
}
export class Conflict extends Error {}
export class Invalid extends Error {
  constructor(message: string, public issues: Issue[] = []) {
    super(message);
  }
}

const RESERVED = new Set(["admin", "api", "login", "einrichten", "embed", "neu", "new", "static"]);

export function normalizeSlug(input: string): string {
  return slugKey(input, new Set(), "formular").replace(/_/g, "-").slice(0, 60);
}

export function slugProblem(slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return "Nur Kleinbuchstaben, Ziffern und Bindestriche, 3 bis 60 Zeichen.";
  if (RESERVED.has(slug)) return "Diese Adresse ist reserviert.";
  return null;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = normalizeSlug(base);
  if (slug.length < 3 || RESERVED.has(slug)) slug = `${slug}-formular`.replace(/^-/, "");
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const exists = await db.query.forms.findFirst({ where: eq(schema.forms.slug, candidate), columns: { id: true } });
    if (!exists) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

// Drizzle schreibt Spalten in der Auswahlliste einer Ein-Tabellen-Abfrage ohne Tabellenpräfix.
// In korrelierten Unterabfragen würde "id" dann auf die innere Tabelle zeigen – daher ausdrücklich.
const FORM_ID = sql.raw(`"forms"."id"`);

/** Wurde die Adresse je bewusst geändert? (Teilen-Seite) – dann nie automatisch ersetzen. */
async function slugCustomised(formId: string): Promise<boolean> {
  const row = await db
    .select({ id: schema.auditLog.id })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.targetId, formId), eq(schema.auditLog.action, "form.settings_changed"), sql`${schema.auditLog.meta}->'fields' ? 'slug'`))
    .limit(1);
  return row.length > 0;
}

export async function listForms(workspaceId: string) {
  const rows = await db
    .select({
      id: schema.forms.id,
      slug: schema.forms.slug,
      status: schema.forms.status,
      draft: schema.forms.draft,
      submissionCount: schema.forms.submissionCount,
      updatedAt: schema.forms.updatedAt,
      publishedVersionId: schema.forms.publishedVersionId,
      newCount: sql<number>`(select count(*)::int from ${schema.submissions} s where s.form_id = ${FORM_ID} and s.status = 'new')`,
      // Tatsächliche Anzahl – submissionCount ist der Nummernzähler (inkl. gelöschter)
      liveCount: sql<number>`(select count(*)::int from ${schema.submissions} s where s.form_id = ${FORM_ID})`,
      lastSubmissionAt: sql<Date | null>`(select max(s.submitted_at) from ${schema.submissions} s where s.form_id = ${FORM_ID})`,
    })
    .from(schema.forms)
    .where(and(eq(schema.forms.workspaceId, workspaceId), isNull(schema.forms.deletedAt)))
    .orderBy(desc(schema.forms.updatedAt));
  // Robust gegen beschädigte Einzelzeilen: ein defektes Formular darf nie die ganze Liste blockieren
  return rows.map((r) => ({ ...r, title: typeof r.draft?.title === "string" ? r.draft.title : "", mode: r.draft?.settings?.mode ?? "classic", draft: undefined }));
}

export async function getForm(workspaceId: string, formId: string) {
  if (!/^[0-9a-f-]{36}$/.test(formId)) throw new NotFound();
  const form = await db.query.forms.findFirst({
    where: and(eq(schema.forms.id, formId), eq(schema.forms.workspaceId, workspaceId), isNull(schema.forms.deletedAt)),
  });
  if (!form) throw new NotFound();
  return form;
}

export async function getPublishedVersion(formId: string, versionId: string | null) {
  if (!versionId) return null;
  return (await db.query.formVersions.findFirst({ where: and(eq(schema.formVersions.id, versionId), eq(schema.formVersions.formId, formId)) })) ?? null;
}

export async function listVersions(workspaceId: string, formId: string) {
  await getForm(workspaceId, formId);
  return db
    .select({
      id: schema.formVersions.id,
      number: schema.formVersions.number,
      publishedAt: schema.formVersions.publishedAt,
      publishedBy: schema.users.name,
      submissions: sql<number>`(select count(*)::int from ${schema.submissions} s where s.version_id = ${schema.formVersions.id})`,
    })
    .from(schema.formVersions)
    .leftJoin(schema.users, eq(schema.users.id, schema.formVersions.publishedBy))
    .where(eq(schema.formVersions.formId, formId))
    .orderBy(desc(schema.formVersions.number));
}

export async function createForm(workspaceId: string, userId: string, definition?: FormDefinition) {
  const def = parseDefinition(definition ?? emptyDefinition());
  const slug = await uniqueSlug(def.title || "formular");
  const [form] = await db.insert(schema.forms).values({ workspaceId, slug, draft: def, createdBy: userId }).returning();
  await audit({ workspaceId, userId, action: "form.created", targetType: "form", targetId: form.id });
  return form;
}

export async function duplicateForm(workspaceId: string, userId: string, formId: string) {
  const src = await getForm(workspaceId, formId);
  const def = { ...src.draft, title: `${src.draft.title} (Kopie)` };
  return createForm(workspaceId, userId, def);
}

/**
 * Entwurf speichern. `revision` schützt vor dem Überschreiben fremder
 * Änderungen (zwei Tabs, zwei Personen): Optimistic Concurrency.
 */
export async function saveDraft(workspaceId: string, formId: string, input: unknown, revision: number) {
  const def = parseDefinition(input);
  const res = await db
    .update(schema.forms)
    .set({ draft: def, draftRevision: sql`${schema.forms.draftRevision} + 1`, updatedAt: new Date() })
    .where(and(eq(schema.forms.id, formId), eq(schema.forms.workspaceId, workspaceId), eq(schema.forms.draftRevision, revision), isNull(schema.forms.deletedAt)))
    .returning({ revision: schema.forms.draftRevision });
  if (res.length === 0) {
    await getForm(workspaceId, formId); // wirft NotFound, falls nicht vorhanden
    throw new Conflict("Das Formular wurde inzwischen an anderer Stelle geändert.");
  }
  return res[0].revision;
}

/** Veröffentlichen = unveränderliche Kopie des Entwurfs als neue Version. */
export async function publishForm(workspaceId: string, userId: string, formId: string) {
  const form = await getForm(workspaceId, formId);
  const def = parseDefinition(form.draft);
  const issues = analyze(def);
  if (hasBlockingIssues(issues)) throw new Invalid("Das Formular enthält noch Fehler.", issues);
  // Erstes Veröffentlichen: Platzhalter-Adresse („unbenanntes-formular-x3k9“) durch eine
  // aus dem inzwischen vergebenen Titel ersetzen. Danach nie mehr automatisch – Links sind geteilt.
  let slug = form.slug;
  if (!form.publishedVersionId && def.title.trim() && !/^unbenanntes formular$/i.test(def.title.trim()) && !(await slugCustomised(formId))) {
    const fromTitle = normalizeSlug(def.title);
    if (fromTitle !== form.slug && !form.slug.startsWith(`${fromTitle}-`)) slug = await uniqueSlug(def.title);
  }
  const version = await db.transaction(async (tx) => {
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${schema.formVersions.number}), 0)::int` })
      .from(schema.formVersions)
      .where(eq(schema.formVersions.formId, formId));
    const [v] = await tx.insert(schema.formVersions).values({ formId, number: max + 1, definition: def, publishedBy: userId }).returning();
    await tx.update(schema.forms).set({ publishedVersionId: v.id, status: "published", slug, updatedAt: new Date() }).where(eq(schema.forms.id, formId));
    return v;
  });
  await audit({ workspaceId, userId, action: "form.published", targetType: "form", targetId: formId, meta: { version: version.number } });
  return { ...version, slug };
}

/** Entwurf auf eine veröffentlichte Version zurücksetzen. */
export async function restoreVersion(workspaceId: string, userId: string, formId: string, versionId: string) {
  await getForm(workspaceId, formId);
  const v = await getPublishedVersion(formId, versionId);
  if (!v) throw new NotFound("Version");
  await db
    .update(schema.forms)
    .set({ draft: v.definition, draftRevision: sql`${schema.forms.draftRevision} + 1`, updatedAt: new Date() })
    .where(eq(schema.forms.id, formId));
  await audit({ workspaceId, userId, action: "form.version_restored", targetType: "form", targetId: formId, meta: { version: v.number } });
}

export async function setFormStatus(workspaceId: string, userId: string, formId: string, status: "published" | "paused" | "archived" | "draft") {
  const form = await getForm(workspaceId, formId);
  if (status === "published" && !form.publishedVersionId) throw new Invalid("Das Formular wurde noch nie veröffentlicht.");
  await db.update(schema.forms).set({ status, updatedAt: new Date() }).where(eq(schema.forms.id, formId));
  await audit({ workspaceId, userId, action: `form.${status}`, targetType: "form", targetId: formId });
}

export async function deleteForm(workspaceId: string, userId: string, formId: string) {
  const before = await getForm(workspaceId, formId);
  // Weiches Löschen; Antworten bleiben bis zur endgültigen Bereinigung erhalten.
  await db.update(schema.forms).set({ deletedAt: new Date(), status: "archived", slug: sql`${schema.forms.slug} || '-geloescht-' || substr(md5(random()::text), 1, 6)` }).where(eq(schema.forms.id, formId));
  // Vorheriger Status im Protokoll – das Zurückholen stellt ihn wieder her
  await audit({ workspaceId, userId, action: "form.deleted", targetType: "form", targetId: formId, meta: { previousStatus: before.status } });
}

/** Tage im Papierkorb, bevor die tägliche Bereinigung endgültig löscht. */
export const TRASH_DAYS = 30;

export async function listTrash(workspaceId: string) {
  const rows = await db
    .select({
      id: schema.forms.id,
      draft: schema.forms.draft,
      deletedAt: schema.forms.deletedAt,
      submissions: sql<number>`(select count(*)::int from ${schema.submissions} s where s.form_id = ${FORM_ID})`,
    })
    .from(schema.forms)
    .where(and(eq(schema.forms.workspaceId, workspaceId), isNotNull(schema.forms.deletedAt)))
    .orderBy(desc(schema.forms.deletedAt));
  return rows.map((r) => ({ id: r.id, title: r.draft.title, deletedAt: r.deletedAt!, submissions: r.submissions, purgeAt: new Date(r.deletedAt!.getTime() + TRASH_DAYS * 86_400_000) }));
}

async function getTrashed(workspaceId: string, formId: string) {
  if (!/^[0-9a-f-]{36}$/.test(formId)) throw new NotFound();
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.id, formId), eq(schema.forms.workspaceId, workspaceId), isNotNull(schema.forms.deletedAt)) });
  if (!form) throw new NotFound();
  return form;
}

/** Aus dem Papierkorb zurückholen – mit dem vorherigen Status; die frühere Adresse, wenn sie noch frei ist. */
export async function restoreForm(workspaceId: string, userId: string, formId: string) {
  const form = await getTrashed(workspaceId, formId);
  const original = form.slug.replace(/-geloescht-[a-z0-9]+$/, "");
  const taken = await db.query.forms.findFirst({ where: eq(schema.forms.slug, original), columns: { id: true } });
  const slug = taken ? await uniqueSlug(original) : original;
  const [del] = await db
    .select({ meta: schema.auditLog.meta })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.targetId, formId), eq(schema.auditLog.action, "form.deleted")))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(1);
  const prev = (del?.meta as { previousStatus?: string } | undefined)?.previousStatus;
  const status = prev === "published" || prev === "paused" ? (form.publishedVersionId ? prev : "draft") : prev === "archived" ? "archived" : "draft";
  await db.update(schema.forms).set({ deletedAt: null, status, slug, updatedAt: new Date() }).where(eq(schema.forms.id, formId));
  await audit({ workspaceId, userId, action: "form.restored", targetType: "form", targetId: formId, meta: { status } });
  return slug;
}

/** Endgültig löschen: Formular, Versionen, Antworten und alle Dateien im Speicher. */
export async function purgeForm(workspaceId: string | null, userId: string | null, formId: string) {
  const form = workspaceId ? await getTrashed(workspaceId, formId) : await db.query.forms.findFirst({ where: eq(schema.forms.id, formId) });
  if (!form) throw new NotFound();
  const fileRows = await db.select({ key: schema.files.storageKey }).from(schema.files).where(eq(schema.files.formId, formId));
  for (const f of fileRows) await deleteObject(f.key).catch(() => {});
  const count = await db.$count(schema.submissions, eq(schema.submissions.formId, formId));
  await db.transaction(async (tx) => {
    await tx.delete(schema.files).where(eq(schema.files.formId, formId));
    // Antworten verweisen ohne Cascade auf Versionen → zuerst Antworten
    await tx.delete(schema.submissions).where(eq(schema.submissions.formId, formId));
    await tx.delete(schema.forms).where(eq(schema.forms.id, formId));
  });
  await audit({ workspaceId: form.workspaceId, userId, action: userId ? "form.purged" : "retention.form_purged", targetType: "form", targetId: formId, meta: { submissions: count, files: fileRows.length } });
  return { submissions: count, files: fileRows.length };
}

export interface PublishSettings {
  slug?: string;
  password?: string | null;
  opensAt?: Date | null;
  closesAt?: Date | null;
  maxSubmissions?: number | null;
  notifyEmails?: string[];
  retentionDays?: number | null;
}

export async function updatePublishSettings(workspaceId: string, userId: string, formId: string, s: PublishSettings) {
  await getForm(workspaceId, formId);
  const patch: Partial<typeof schema.forms.$inferInsert> = { updatedAt: new Date() };
  if (s.slug !== undefined) {
    const problem = slugProblem(s.slug);
    if (problem) throw new Invalid(problem);
    const taken = await db.query.forms.findFirst({ where: and(eq(schema.forms.slug, s.slug), sql`${schema.forms.id} <> ${formId}`), columns: { id: true } });
    if (taken) throw new Invalid("Diese Adresse ist bereits vergeben.");
    patch.slug = s.slug;
  }
  if (s.password !== undefined) patch.passwordHash = s.password ? await hashPassword(s.password) : null;
  if (s.opensAt !== undefined) patch.opensAt = s.opensAt;
  if (s.closesAt !== undefined) patch.closesAt = s.closesAt;
  if (s.maxSubmissions !== undefined) patch.maxSubmissions = s.maxSubmissions;
  if (s.notifyEmails !== undefined) patch.notifyEmails = s.notifyEmails;
  if (s.retentionDays !== undefined) patch.retentionDays = s.retentionDays;
  await db.update(schema.forms).set(patch).where(eq(schema.forms.id, formId));
  await audit({ workspaceId, userId, action: "form.settings_changed", targetType: "form", targetId: formId, meta: { fields: Object.keys(s) } });
}

/** Warum ein Formular gerade keine Antworten annimmt – oder null. */
export function closedReason(form: Pick<typeof schema.forms.$inferSelect, "status" | "opensAt" | "closesAt" | "maxSubmissions" | "submissionCount">, now = new Date()): string | null {
  if (form.status === "paused") return "Dieses Formular nimmt vorübergehend keine Antworten an.";
  if (form.status !== "published") return "Dieses Formular ist nicht mehr verfügbar.";
  if (form.opensAt && form.opensAt > now) return `Dieses Formular ist ab ${form.opensAt.toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" })} Uhr geöffnet.`;
  if (form.closesAt && form.closesAt <= now) return "Die Frist für dieses Formular ist abgelaufen.";
  if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) return "Dieses Formular hat die maximale Anzahl an Antworten erreicht.";
  return null;
}
