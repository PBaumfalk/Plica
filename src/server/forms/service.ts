/**
 * Formulare: Entwurf, Veröffentlichung, Versionen, Status.
 * Jede Funktion nimmt die workspaceId des angemeldeten Nutzers entgegen –
 * fremde IDs führen schlicht zu „nicht gefunden“ (kein IDOR).
 */
import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { analyze, hasBlockingIssues, type Issue } from "@/lib/forms/analyze";
import { emptyDefinition, slugKey } from "@/lib/forms/fields";
import { parseDefinition, type FormDefinition } from "@/lib/forms/schema";
import { audit } from "../audit";
import { hashPassword } from "../auth/password";
import { db, schema } from "../db";
import { randomToken } from "../lib/crypto";

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
  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug)) return "Nur Kleinbuchstaben, Ziffern und Bindestriche, 3 bis 60 Zeichen.";
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
      newCount: sql<number>`(select count(*)::int from ${schema.submissions} s where s.form_id = ${schema.forms.id} and s.status = 'new')`,
      lastSubmissionAt: sql<Date | null>`(select max(s.submitted_at) from ${schema.submissions} s where s.form_id = ${schema.forms.id})`,
    })
    .from(schema.forms)
    .where(and(eq(schema.forms.workspaceId, workspaceId), isNull(schema.forms.deletedAt)))
    .orderBy(desc(schema.forms.updatedAt));
  return rows.map((r) => ({ ...r, title: r.draft.title, mode: r.draft.settings.mode, draft: undefined }));
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
  const version = await db.transaction(async (tx) => {
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${schema.formVersions.number}), 0)::int` })
      .from(schema.formVersions)
      .where(eq(schema.formVersions.formId, formId));
    const [v] = await tx.insert(schema.formVersions).values({ formId, number: max + 1, definition: def, publishedBy: userId }).returning();
    await tx.update(schema.forms).set({ publishedVersionId: v.id, status: "published", updatedAt: new Date() }).where(eq(schema.forms.id, formId));
    return v;
  });
  await audit({ workspaceId, userId, action: "form.published", targetType: "form", targetId: formId, meta: { version: version.number } });
  return version;
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
  await getForm(workspaceId, formId);
  // Weiches Löschen; Antworten bleiben bis zur endgültigen Bereinigung erhalten.
  await db.update(schema.forms).set({ deletedAt: new Date(), status: "archived", slug: sql`${schema.forms.slug} || '-geloescht-' || substr(md5(random()::text), 1, 6)` }).where(eq(schema.forms.id, formId));
  await audit({ workspaceId, userId, action: "form.deleted", targetType: "form", targetId: formId });
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
