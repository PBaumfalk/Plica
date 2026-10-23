/**
 * Datenbankschema (PostgreSQL). Jede fachliche Tabelle trägt die
 * workspace_id, damit Zugriffe immer auf einen Workspace eingegrenzt
 * werden können (Schutz vor Datenabfluss zwischen Workspaces).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { FormDefinition } from "@/lib/forms/schema";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const now = (name: string) => ts(name).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["owner", "admin", "editor", "reviewer", "viewer"]);
export const formStatusEnum = pgEnum("form_status", ["draft", "published", "paused", "archived"]);
export const submissionStatusEnum = pgEnum("submission_status", ["new", "in_review", "approved", "rejected", "done", "spam"]);
export const fileStatusEnum = pgEnum("file_status", ["pending", "clean", "unscanned", "infected"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "done", "failed", "dead"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: now("updated_at"),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** AES-GCM verschlüsselt mit SECRET_KEY. */
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    recoveryCodes: jsonb("recovery_codes").$type<string[]>(),
    /** „<issuer>|<sub>“ des OIDC-Anbieters, falls das Konto per SSO verknüpft ist. */
    oidcSubject: text("oidc_subject"),
    isInstanceAdmin: boolean("is_instance_admin").notNull().default(false),
    disabledAt: ts("disabled_at"),
    lastLoginAt: ts("last_login_at"),
    createdAt: now("created_at"),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`), uniqueIndex("users_oidc_subject_idx").on(t.oidcSubject)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Standard-Aufbewahrung von Antworten in Tagen (null = unbegrenzt). */
  retentionDays: integer("retention_days"),
  /** Geheimnis für Webhook-Signaturen (verschlüsselt). */
  webhookSecret: text("webhook_secret").notNull(),
  createdAt: now("created_at"),
});

export const memberships = pgTable(
  "memberships",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: now("created_at"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("memberships_user_idx").on(t.userId)],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  createdAt: now("created_at"),
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha256(token) – das Token selbst liegt nur im Cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    /** true, solange der zweite Faktor noch aussteht. */
    mfaPending: boolean("mfa_pending").notNull().default(false),
    /** Über OIDC angemeldet (für das Abmelden beim Anbieter). */
    viaOidc: boolean("via_oidc").notNull().default(false),
    /** ID-Token des Anbieters (verschlüsselt) – nur als id_token_hint beim Abmelden. */
    oidcIdToken: text("oidc_id_token"),
    device: text("device"),
    createdAt: now("created_at"),
    lastSeenAt: now("last_seen_at"),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  scope: text("scope", { enum: ["read", "write"] }).notNull(),
  expiresAt: ts("expires_at"),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
  createdAt: now("created_at"),
});

export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    /** Öffentliche Adresse /f/<slug>, instanzweit eindeutig. */
    slug: text("slug").notNull().unique(),
    status: formStatusEnum("status").notNull().default("draft"),
    /** Arbeitsstand des Editors. Öffentlich gilt nur die veröffentlichte Version. */
    draft: jsonb("draft").$type<FormDefinition>().notNull(),
    draftRevision: integer("draft_revision").notNull().default(1),
    publishedVersionId: uuid("published_version_id"),
    passwordHash: text("password_hash"),
    opensAt: ts("opens_at"),
    closesAt: ts("closes_at"),
    maxSubmissions: integer("max_submissions"),
    retentionDays: integer("retention_days"),
    /** E-Mail-Benachrichtigung an Bearbeiter bei neuer Antwort. */
    notifyEmails: jsonb("notify_emails").$type<string[]>().notNull().default([]),
    submissionCount: integer("submission_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now("created_at"),
    updatedAt: now("updated_at"),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("forms_ws_idx").on(t.workspaceId)],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    definition: jsonb("definition").$type<FormDefinition>().notNull(),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: now("published_at"),
  },
  (t) => [uniqueIndex("form_versions_num_idx").on(t.formId, t.number)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => formVersions.id),
    /** Laufende Nummer je Formular (#17). */
    number: integer("number").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    status: submissionStatusEnum("status").notNull().default("new"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    starred: boolean("starred").notNull().default(false),
    endingId: text("ending_id"),
    /** Volltext für die Suche (aus formatierten Antworten). */
    searchText: text("search_text").notNull().default(""),
    /** Kontaktadresse des Einreichenden, falls ein E-Mail-Feld existiert. */
    respondentEmail: text("respondent_email"),
    meta: jsonb("meta").$type<{ durationMs?: number; language?: string; embedded?: boolean; referrer?: string; userAgent?: string; prefillFrom?: string }>().notNull().default({}),
    /** Idempotenzschlüssel des Clients – doppeltes Absenden erzeugt keine zweite Antwort. */
    clientKey: text("client_key"),
    submittedAt: now("submitted_at"),
    updatedAt: now("updated_at"),
    deleteAfter: ts("delete_after"),
  },
  (t) => [
    index("submissions_form_idx").on(t.formId, t.submittedAt),
    index("submissions_ws_idx").on(t.workspaceId),
    uniqueIndex("submissions_number_idx").on(t.formId, t.number),
    uniqueIndex("submissions_client_key_idx").on(t.formId, t.clientKey),
    index("submissions_search_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const submissionNotes = pgTable("submission_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: now("created_at"),
});

/** Nachvollziehbare Bearbeitungshistorie je Antwort. */
export const submissionEvents = pgTable(
  "submission_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: now("created_at"),
  },
  (t) => [index("submission_events_sub_idx").on(t.submissionId)],
);

export const files = pgTable(
  "files",
  {
    id: text("id").primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id").references(() => forms.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    fieldId: text("field_id"),
    /** Bindet einen Upload an die Ausfüll-Sitzung, bevor eine Antwort existiert. */
    uploadSession: text("upload_session"),
    kind: text("kind", { enum: ["upload", "signature", "pdf", "asset"] }).notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    status: fileStatusEnum("status").notNull().default("pending"),
    scanNote: text("scan_note"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: now("created_at"),
  },
  (t) => [index("files_submission_idx").on(t.submissionId), index("files_session_idx").on(t.uploadSession)],
);

/** Zwischenstände für sichere Fortsetzungslinks. */
export const resumeDrafts = pgTable("resume_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull().references(() => formVersions.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  /** Verschlüsselt (AES-GCM), da sensible Zwischenstände. */
  data: text("data").notNull(),
  pageId: text("page_id"),
  uploadSession: text("upload_session"),
  expiresAt: ts("expires_at").notNull(),
  updatedAt: now("updated_at"),
});

/** Anonyme Ereignisse für Abbruchanalyse – keine IP, keine Cookies. */
export const formEvents = pgTable(
  "form_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
    versionId: uuid("version_id"),
    visit: text("visit").notNull(),
    type: text("type", { enum: ["view", "start", "page", "field", "submit"] }).notNull(),
    pageId: text("page_id"),
    fieldId: text("field_id"),
    createdAt: now("created_at"),
  },
  (t) => [index("form_events_form_idx").on(t.formId, t.createdAt)],
);

export type WorkflowTrigger = "submission.created" | "submission.status_changed" | "approval.approved" | "approval.rejected";
export type WorkflowStep =
  | { id: string; type: "email"; to: string; subject: string; body: string; attachPdf?: boolean }
  | { id: string; type: "confirmation"; subject: string; body: string; attachPdf?: boolean }
  | { id: string; type: "webhook"; url: string }
  | { id: string; type: "set_status"; status: "new" | "in_review" | "approved" | "rejected" | "done" }
  | { id: string; type: "approval"; title: string; assigneeRole: "owner" | "admin" | "editor" | "reviewer" }
  | { id: string; type: "pdf" };

export interface WorkflowCondition {
  match: "all" | "any";
  conditions: { fieldId: string; operator: string; value?: string | number | boolean | string[] }[];
}

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  trigger: text("trigger").$type<WorkflowTrigger>().notNull(),
  /** Bei Statuswechsel: nur bei diesem Zielstatus. */
  triggerStatus: text("trigger_status"),
  condition: jsonb("condition").$type<WorkflowCondition | null>(),
  steps: jsonb("steps").$type<WorkflowStep[]>().notNull().default([]),
  /** Schritte, die ausgeführt werden, wenn die Bedingung NICHT zutrifft. */
  elseSteps: jsonb("else_steps").$type<WorkflowStep[]>().notNull().default([]),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
});

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(),
    status: text("status", { enum: ["running", "succeeded", "failed", "partial"] }).notNull().default("running"),
    branch: text("branch", { enum: ["then", "else"] }),
    log: jsonb("log").$type<{ at: string; step: string; ok: boolean; message: string; attempt?: number }[]>().notNull().default([]),
    createdAt: now("created_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("workflow_runs_wf_idx").on(t.workflowId, t.createdAt)],
);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  assigneeRole: roleEnum("assignee_role").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  comment: text("comment"),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: ts("decided_at"),
  createdAt: now("created_at"),
});

/** Dauerhafte Queue: SELECT … FOR UPDATE SKIP LOCKED, Idempotenzschlüssel. */
export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    idempotencyKey: text("idempotency_key").unique(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(6),
    runAt: now("run_at"),
    lockedAt: ts("locked_at"),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    /** Zwischenergebnisse (z. B. erledigte Workflow-Schritte) für sichere Fortsetzung. */
    progress: jsonb("progress").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: now("created_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("jobs_ready_idx").on(t.status, t.runAt)],
);

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: jsonb("query").$type<Record<string, unknown>>().notNull(),
  shared: boolean("shared").notNull().default(false),
  createdAt: now("created_at"),
});

export const pdfTemplates = pgTable("pdf_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  formId: uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Einfaches Markup mit {{schluessel}}-Platzhaltern. */
  body: text("body").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
});

/** Wiederverwendbare Formularbausteine. */
export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  fields: jsonb("fields").$type<unknown[]>().notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: now("created_at"),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: uuid("workspace_id"),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: now("created_at"),
  },
  (t) => [index("audit_ws_idx").on(t.workspaceId, t.createdAt)],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type SubmissionStatus = (typeof submissionStatusEnum.enumValues)[number];
export type FormRow = typeof forms.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type UserRow = typeof users.$inferSelect;
