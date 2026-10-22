/**
 * Antworten verwalten: Liste, Detail, Status, Tags, Notizen, Löschen.
 * Jede Funktion ist auf den Workspace des Aufrufers begrenzt – fremde
 * IDs verhalten sich wie nicht vorhanden.
 */
import "server-only";
import { toNumber } from "@/lib/forms/number";
import { emitStatusChanged } from "../workflows/events";
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { FormDefinition } from "@/lib/forms/schema";
import { audit } from "../audit";
import { db, schema } from "../db";
import type { SubmissionStatus } from "../db/schema";
import { deleteObject } from "../storage/s3";
import { NotFound } from "../forms/service";

export const STATUSES: SubmissionStatus[] = ["new", "in_review", "approved", "rejected", "done", "spam"];
export const SORTS = ["newest", "oldest", "number_desc", "number_asc"] as const;
export type Sort = (typeof SORTS)[number];

export interface ListQuery {
  q?: string;
  status?: SubmissionStatus[];
  tags?: string[];
  starred?: boolean;
  /** ISO-Datum YYYY-MM-DD, inklusive */
  from?: string;
  to?: string;
  field?: { fieldId: string; op: "contains" | "eq" | "gt" | "lt" | "empty" | "not_empty"; value?: string };
  sort?: Sort;
  page?: number;
  pageSize?: number;
  ids?: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** URL-Suchparameter → ListQuery (robust gegen Unsinn). */
export function parseListQuery(sp: Record<string, string | string[] | undefined>): ListQuery {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : Array.isArray(sp[k]) ? (sp[k] as string[])[0] : undefined);
  const q: ListQuery = {};
  const text = one("q")?.trim();
  if (text) q.q = text.slice(0, 200);
  const st = one("status")?.split(",").filter((s): s is SubmissionStatus => (STATUSES as string[]).includes(s));
  if (st?.length) q.status = st;
  const tags = one("tags")?.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
  if (tags?.length) q.tags = tags;
  if (one("starred") === "1") q.starred = true;
  const from = one("from");
  if (from && DAY.test(from)) q.from = from;
  const to = one("to");
  if (to && DAY.test(to)) q.to = to;
  const fid = one("ff");
  const fop = one("fop");
  if (fid && /^[A-Za-z0-9_-]{1,64}$/.test(fid) && (fop === "contains" || fop === "eq" || fop === "gt" || fop === "lt" || fop === "empty" || fop === "not_empty")) {
    q.field = { fieldId: fid, op: fop, value: one("fv")?.slice(0, 200) };
  }
  const sort = one("sort");
  if (sort && (SORTS as readonly string[]).includes(sort)) q.sort = sort as Sort;
  const page = Number(one("page"));
  if (Number.isInteger(page) && page > 1 && page < 100_000) q.page = page;
  return q;
}

/** ListQuery → URL-Suchparameter (Gegenstück zu parseListQuery). */
export function listQueryToParams(q: ListQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.status?.length) p.set("status", q.status.join(","));
  if (q.tags?.length) p.set("tags", q.tags.join(","));
  if (q.starred) p.set("starred", "1");
  if (q.from) p.set("from", q.from);
  if (q.to) p.set("to", q.to);
  if (q.field) {
    p.set("ff", q.field.fieldId);
    p.set("fop", q.field.op);
    if (q.field.value) p.set("fv", q.field.value);
  }
  if (q.sort && q.sort !== "newest") p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  return p;
}

function whereFor(workspaceId: string, formId: string, q: ListQuery): SQL {
  const s = schema.submissions;
  const parts: (SQL | undefined)[] = [eq(s.workspaceId, workspaceId), eq(s.formId, formId)];
  if (q.ids) parts.push(q.ids.length ? inArray(s.id, q.ids.filter((i) => UUID.test(i))) : sql`false`);
  if (q.status?.length) parts.push(inArray(s.status, q.status));
  else if (!q.ids) parts.push(sql`${s.status} <> 'spam'`);
  if (q.starred) parts.push(eq(s.starred, true));
  for (const t of q.tags ?? []) parts.push(sql`${s.tags} @> ${JSON.stringify([t])}::jsonb`);
  if (q.from) parts.push(gte(s.submittedAt, new Date(`${q.from}T00:00:00`)));
  if (q.to) parts.push(lt(s.submittedAt, new Date(new Date(`${q.to}T00:00:00`).getTime() + 86_400_000)));
  if (q.q) {
    const like = `%${likeEscape(q.q)}%`;
    const n = Number(q.q.replace(/^#/, ""));
    parts.push(or(sql`${s.searchText} ilike ${like}`, sql`${s.respondentEmail} ilike ${like}`, Number.isInteger(n) && n > 0 ? eq(s.number, n) : undefined, UUID.test(q.q) ? eq(s.id, q.q) : undefined));
  }
  if (q.field) {
    const cell = sql`(${s.data} -> ${q.field.fieldId})`;
    if (q.field.op === "empty") parts.push(sql`(${cell} is null or ${cell} in ('""'::jsonb, '[]'::jsonb, '{}'::jsonb))`);
    else if (q.field.op === "not_empty") parts.push(sql`(${cell} is not null and ${cell} not in ('""'::jsonb, '[]'::jsonb, '{}'::jsonb))`);
    else if (q.field.value !== undefined && q.field.value !== "") {
      // Eingaben wie im Formular verstehen: „12.345,67“ und „29.02.1980“
      const raw = q.field.value;
      const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw.trim());
      const iso = de ? `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null;
      const num = iso ? null : toNumber(raw);
      const text = sql`(${s.data} ->> ${q.field.fieldId})`;
      const asNum = sql`(case when ${text} ~ '^-?[0-9]+(\.[0-9]+)?$' then ${text}::numeric end)`;
      if (q.field.op === "eq") {
        parts.push(
          or(
            sql`lower(${text}) = lower(${raw})`,
            iso ? sql`left(${text}, 10) = ${iso}` : undefined,
            num !== null ? sql`${asNum} = ${num}` : undefined,
            sql`${cell} @> ${JSON.stringify([raw])}::jsonb`,
          ),
        );
      } else if (q.field.op === "gt" || q.field.op === "lt") {
        const cmp = q.field.op === "gt" ? sql`>` : sql`<`;
        if (iso) parts.push(sql`left(${text}, 10) ${cmp} ${iso}`);
        else if (num !== null) parts.push(sql`${asNum} ${cmp} ${num}`);
        else parts.push(sql`false`);
      } else {
        const needle = iso ?? (num !== null && /[.,]/.test(raw) ? String(num) : raw);
        parts.push(or(sql`${cell}::text ilike ${`%${likeEscape(raw)}%`}`, needle !== raw ? sql`${cell}::text ilike ${`%${likeEscape(needle)}%`}` : undefined));
      }
    }
  }
  return and(...parts.filter(Boolean))!;
}

function orderFor(sort: Sort = "newest") {
  const s = schema.submissions;
  switch (sort) {
    case "oldest": return [asc(s.submittedAt), asc(s.number)];
    case "number_asc": return [asc(s.number)];
    case "number_desc": return [desc(s.number)];
    default: return [desc(s.submittedAt), desc(s.number)];
  }
}

export async function assertForm(workspaceId: string, formId: string) {
  if (!UUID.test(formId)) throw new NotFound();
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.id, formId), eq(schema.forms.workspaceId, workspaceId), isNull(schema.forms.deletedAt)) });
  if (!form) throw new NotFound();
  return form;
}

export type ListRow = Pick<typeof schema.submissions.$inferSelect, "id" | "number" | "data" | "status" | "tags" | "starred" | "submittedAt" | "versionId" | "respondentEmail">;

export async function listSubmissions(workspaceId: string, formId: string, q: ListQuery) {
  await assertForm(workspaceId, formId);
  const pageSize = Math.min(Math.max(q.pageSize ?? 50, 1), 500);
  const page = q.page ?? 1;
  const where = whereFor(workspaceId, formId, q);
  const s = schema.submissions;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ id: s.id, number: s.number, data: s.data, status: s.status, tags: s.tags, starred: s.starred, submittedAt: s.submittedAt, versionId: s.versionId, respondentEmail: s.respondentEmail })
      .from(s)
      .where(where)
      .orderBy(...orderFor(q.sort))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(s).where(where),
  ]);
  return { rows: rows as ListRow[], total, page, pageSize };
}

/** Alle Treffer in Stapeln (für Exporte, ohne alles auf einmal zu laden). */
export async function* iterateSubmissions(workspaceId: string, formId: string, q: ListQuery, batch = 500) {
  const where = whereFor(workspaceId, formId, q);
  for (let offset = 0; ; offset += batch) {
    const rows = await db.select().from(schema.submissions).where(where).orderBy(...orderFor(q.sort ?? "number_asc")).limit(batch).offset(offset);
    if (!rows.length) return;
    yield rows;
    if (rows.length < batch) return;
  }
}

/** Alle Versionen eines Formulars, älteste zuerst. */
export async function formVersions(formId: string) {
  return db.select({ id: schema.formVersions.id, number: schema.formVersions.number, definition: schema.formVersions.definition }).from(schema.formVersions).where(eq(schema.formVersions.formId, formId)).orderBy(asc(schema.formVersions.number));
}

export async function formTags(workspaceId: string, formId: string): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(sql`select distinct jsonb_array_elements_text(tags) as tag from ${schema.submissions} where workspace_id = ${workspaceId} and form_id = ${formId} order by 1 limit 200`);
  return rows.map((r) => r.tag);
}

export async function statusCounts(workspaceId: string, formId: string) {
  const rows = await db
    .select({ status: schema.submissions.status, n: sql<number>`count(*)::int` })
    .from(schema.submissions)
    .where(and(eq(schema.submissions.workspaceId, workspaceId), eq(schema.submissions.formId, formId)))
    .groupBy(schema.submissions.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<SubmissionStatus, number>>;
}

export async function getSubmission(workspaceId: string, submissionId: string) {
  if (!UUID.test(submissionId)) throw new NotFound("Antwort");
  const sub = await db.query.submissions.findFirst({ where: and(eq(schema.submissions.id, submissionId), eq(schema.submissions.workspaceId, workspaceId)) });
  if (!sub) throw new NotFound("Antwort");
  const version = await db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, sub.versionId) });
  return { submission: sub, version: version!, definition: version!.definition as FormDefinition };
}

export async function submissionDetail(workspaceId: string, submissionId: string) {
  const base = await getSubmission(workspaceId, submissionId);
  const { submission } = base;
  const [files, notes, events, runs, form] = await Promise.all([
    db.select().from(schema.files).where(and(eq(schema.files.submissionId, submission.id), eq(schema.files.workspaceId, workspaceId))).orderBy(asc(schema.files.createdAt)),
    db
      .select({ id: schema.submissionNotes.id, body: schema.submissionNotes.body, createdAt: schema.submissionNotes.createdAt, userId: schema.submissionNotes.userId, user: schema.users.name })
      .from(schema.submissionNotes)
      .leftJoin(schema.users, eq(schema.users.id, schema.submissionNotes.userId))
      .where(eq(schema.submissionNotes.submissionId, submission.id))
      .orderBy(asc(schema.submissionNotes.createdAt)),
    db
      .select({ id: schema.submissionEvents.id, type: schema.submissionEvents.type, data: schema.submissionEvents.data, createdAt: schema.submissionEvents.createdAt, user: schema.users.name })
      .from(schema.submissionEvents)
      .leftJoin(schema.users, eq(schema.users.id, schema.submissionEvents.userId))
      .where(eq(schema.submissionEvents.submissionId, submission.id))
      .orderBy(asc(schema.submissionEvents.createdAt)),
    db
      .select({ id: schema.workflowRuns.id, status: schema.workflowRuns.status, trigger: schema.workflowRuns.trigger, createdAt: schema.workflowRuns.createdAt, name: schema.workflows.name, log: schema.workflowRuns.log })
      .from(schema.workflowRuns)
      .innerJoin(schema.workflows, eq(schema.workflows.id, schema.workflowRuns.workflowId))
      .where(and(eq(schema.workflowRuns.submissionId, submission.id), eq(schema.workflowRuns.workspaceId, workspaceId)))
      .orderBy(asc(schema.workflowRuns.createdAt)),
    db.query.forms.findFirst({ where: eq(schema.forms.id, submission.formId), columns: { id: true, draft: true, slug: true } }),
  ]);
  return { ...base, files, notes, events, runs, formTitle: form?.draft.title ?? "" };
}

/** Nachbarn in der aktuellen Sortierung (für Vor/Zurück). */
export async function neighbours(workspaceId: string, formId: string, q: ListQuery, submissionId: string) {
  const where = whereFor(workspaceId, formId, { ...q, page: undefined });
  const rows = await db.execute<{ prev: string | null; next: string | null }>(sql`
    select prev, next from (
      select id, lag(id) over w as prev, lead(id) over w as next
      from ${schema.submissions}
      where ${where}
      window w as (order by ${sql.join(orderFor(q.sort).map((o) => o), sql`, `)})
    ) t where id = ${submissionId}`);
  return { prev: rows[0]?.prev ?? null, next: rows[0]?.next ?? null };
}

/* ---------------- Änderungen ---------------- */

async function scopedIds(workspaceId: string, ids: string[]) {
  const clean = [...new Set(ids)].filter((i) => UUID.test(i)).slice(0, 1000);
  if (!clean.length) return [];
  const rows = await db
    .select({ id: schema.submissions.id, status: schema.submissions.status, tags: schema.submissions.tags, formId: schema.submissions.formId, starred: schema.submissions.starred })
    .from(schema.submissions)
    .where(and(eq(schema.submissions.workspaceId, workspaceId), inArray(schema.submissions.id, clean)));
  return rows;
}

export async function setStatus(workspaceId: string, userId: string, ids: string[], status: SubmissionStatus) {
  if (!STATUSES.includes(status)) throw new Error("invalid status");
  const rows = await scopedIds(workspaceId, ids);
  let changed = 0;
  for (const r of rows) {
    if (r.status === status) continue;
    // Zentral über emitStatusChanged: Verlauf, Workflow-Auslöser und Schleifenschutz an einer Stelle
    if (!(await emitStatusChanged({ submissionId: r.id, from: r.status, to: status, userId, source: "ui" }))) continue;
    changed++;
  }
  return changed;
}

function cleanTag(t: string) {
  return t.trim().replace(/\s+/g, " ").slice(0, 40);
}

export async function changeTags(workspaceId: string, userId: string, ids: string[], add: string[], remove: string[]) {
  const addC = add.map(cleanTag).filter(Boolean);
  const remC = remove.map(cleanTag).filter(Boolean);
  const rows = await scopedIds(workspaceId, ids);
  for (const r of rows) {
    const next = [...new Set([...r.tags.filter((t) => !remC.includes(t)), ...addC])].slice(0, 30);
    if (JSON.stringify(next) === JSON.stringify(r.tags)) continue;
    await db.update(schema.submissions).set({ tags: next, updatedAt: new Date() }).where(eq(schema.submissions.id, r.id));
    const added = next.filter((t) => !r.tags.includes(t));
    const removed = r.tags.filter((t) => !next.includes(t));
    await db.insert(schema.submissionEvents).values({ submissionId: r.id, userId, type: "tags", data: { added, removed } });
  }
  return rows.length;
}

export async function setStarred(workspaceId: string, userId: string, ids: string[], starred: boolean) {
  const rows = await scopedIds(workspaceId, ids);
  const targets = rows.filter((r) => r.starred !== starred).map((r) => r.id);
  if (targets.length) {
    await db.update(schema.submissions).set({ starred }).where(inArray(schema.submissions.id, targets));
    await db.insert(schema.submissionEvents).values(targets.map((id) => ({ submissionId: id, userId, type: starred ? "starred" : "unstarred", data: {} })));
  }
  return targets.length;
}

export async function addNote(workspaceId: string, userId: string, submissionId: string, body: string) {
  const text = body.trim().slice(0, 10_000);
  if (!text) throw new Error("empty");
  const [row] = await scopedIds(workspaceId, [submissionId]);
  if (!row) throw new NotFound("Antwort");
  const [note] = await db.insert(schema.submissionNotes).values({ submissionId, userId, body: text }).returning();
  await db.insert(schema.submissionEvents).values({ submissionId, userId, type: "note_added", data: { preview: text.slice(0, 80) } });
  return note;
}

export async function deleteNote(workspaceId: string, userId: string, noteId: string, isAdmin: boolean) {
  if (!UUID.test(noteId)) throw new NotFound("Notiz");
  const rows = await db
    .select({ id: schema.submissionNotes.id, userId: schema.submissionNotes.userId, submissionId: schema.submissionNotes.submissionId })
    .from(schema.submissionNotes)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.submissionNotes.submissionId))
    .where(and(eq(schema.submissionNotes.id, noteId), eq(schema.submissions.workspaceId, workspaceId)));
  const note = rows[0];
  if (!note) throw new NotFound("Notiz");
  if (note.userId !== userId && !isAdmin) throw new Error("Nur eigene Notizen können gelöscht werden.");
  await db.delete(schema.submissionNotes).where(eq(schema.submissionNotes.id, noteId));
  await db.insert(schema.submissionEvents).values({ submissionId: note.submissionId, userId, type: "note_deleted", data: {} });
}

/** Endgültiges Löschen inklusive aller Dateien im Objektspeicher. */
export async function deleteSubmissions(workspaceId: string, userId: string, ids: string[]) {
  const rows = await scopedIds(workspaceId, ids);
  if (!rows.length) return 0;
  const subIds = rows.map((r) => r.id);
  const fileRows = await db.select({ key: schema.files.storageKey }).from(schema.files).where(and(eq(schema.files.workspaceId, workspaceId), inArray(schema.files.submissionId, subIds)));
  await db.delete(schema.submissions).where(and(eq(schema.submissions.workspaceId, workspaceId), inArray(schema.submissions.id, subIds)));
  for (const f of fileRows) {
    try {
      await deleteObject(f.key);
    } catch (e) {
      console.error("[delete] Objekt konnte nicht gelöscht werden:", f.key, e instanceof Error ? e.message : e);
    }
  }
  const forms = [...new Set(rows.map((r) => r.formId))];
  await audit({ workspaceId, userId, action: "submissions.deleted", targetType: "form", targetId: forms.join(","), meta: { count: subIds.length, files: fileRows.length, ids: subIds.slice(0, 100) } });
  return subIds.length;
}

/* ---------------- Gespeicherte Ansichten ---------------- */

export async function listViews(workspaceId: string, formId: string, userId: string) {
  await assertForm(workspaceId, formId);
  return db
    .select({ id: schema.savedViews.id, name: schema.savedViews.name, query: schema.savedViews.query, shared: schema.savedViews.shared, userId: schema.savedViews.userId })
    .from(schema.savedViews)
    .where(and(eq(schema.savedViews.formId, formId), or(eq(schema.savedViews.userId, userId), eq(schema.savedViews.shared, true))))
    .orderBy(asc(schema.savedViews.createdAt));
}

export async function saveView(workspaceId: string, formId: string, userId: string, name: string, query: Record<string, string>, shared: boolean) {
  await assertForm(workspaceId, formId);
  const [row] = await db.insert(schema.savedViews).values({ formId, userId, name: name.trim().slice(0, 60) || "Ansicht", query, shared }).returning();
  return row;
}

export async function deleteView(workspaceId: string, formId: string, userId: string, viewId: string, isAdmin: boolean) {
  await assertForm(workspaceId, formId);
  if (!UUID.test(viewId)) throw new NotFound("Ansicht");
  const view = await db.query.savedViews.findFirst({ where: and(eq(schema.savedViews.id, viewId), eq(schema.savedViews.formId, formId)) });
  if (!view) throw new NotFound("Ansicht");
  if (view.userId !== userId && !isAdmin) throw new Error("Nur eigene Ansichten können gelöscht werden.");
  await db.delete(schema.savedViews).where(eq(schema.savedViews.id, viewId));
}
