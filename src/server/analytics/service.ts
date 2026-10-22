/**
 * Auswertung eines Formulars aus anonymen Ereignissen (form_events) und
 * echten Antworten. Keine IP-Adressen, keine Cookies: Ein „Besuch“ ist eine
 * zufällige ID pro Seitenaufruf.
 */
import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { formatValue } from "@/lib/forms/format";
import { fieldIndex, type FormDefinition } from "@/lib/forms/schema";
import { db, schema } from "../db";

export interface Analytics {
  days: number;
  views: number;
  starts: number;
  submissions: number;
  measuredSubmits: number;
  completionRate: number | null;
  startRate: number | null;
  medianMs: number | null;
  funnel: { id: string; label: string; count: number }[];
  /** true, wenn das Formular Schritte hat, die einzeln gemessen werden */
  stepped: boolean;
  daily: { date: string; count: number }[];
  distributions: { fieldId: string; label: string; type: string; total: number; rows: { label: string; count: number }[]; average?: number }[];
}

const CHOICE = new Set(["dropdown", "single_choice", "multi_select", "checkboxes", "yes_no", "rating"]);

export async function formAnalytics(workspaceId: string, formId: string, def: FormDefinition, days: number): Promise<Analytics> {
  const since = new Date(Date.now() - days * 86_400_000);
  const evWhere = and(eq(schema.formEvents.formId, formId), gte(schema.formEvents.createdAt, since));

  const [counts] = await db
    .select({
      views: sql<number>`count(distinct ${schema.formEvents.visit}) filter (where ${schema.formEvents.type} = 'view')::int`,
      starts: sql<number>`count(distinct ${schema.formEvents.visit}) filter (where ${schema.formEvents.type} = 'start')::int`,
      submitVisits: sql<number>`count(distinct ${schema.formEvents.visit}) filter (where ${schema.formEvents.type} = 'submit')::int`,
    })
    .from(schema.formEvents)
    .where(evWhere);

  const subWhere = and(eq(schema.submissions.formId, formId), eq(schema.submissions.workspaceId, workspaceId), gte(schema.submissions.submittedAt, since), sql`${schema.submissions.status} <> 'spam'`);
  const [subs] = await db
    .select({
      n: sql<number>`count(*)::int`,
      median: sql<number | null>`percentile_cont(0.5) within group (order by (${schema.submissions.meta}->>'durationMs')::numeric)`,
    })
    .from(schema.submissions)
    .where(subWhere);

  // Seitenweise: wie viele Besuche haben die jeweilige Seite erreicht?
  const pageRows = await db
    .select({ pageId: schema.formEvents.pageId, n: sql<number>`count(distinct ${schema.formEvents.visit})::int` })
    .from(schema.formEvents)
    .where(and(evWhere, eq(schema.formEvents.type, "page")))
    .groupBy(schema.formEvents.pageId);
  const reached = new Map(pageRows.map((r) => [r.pageId, r.n]));
  const stepped = def.settings.mode !== "classic" && def.pages.length > 1;

  const funnel: Analytics["funnel"] = [
    { id: "view", label: "Aufgerufen", count: counts.views },
    { id: "start", label: "Begonnen", count: counts.starts },
  ];
  if (stepped) {
    def.pages.forEach((p, i) => {
      if (i === 0) return;
      funnel.push({ id: p.id, label: p.title || `Seite ${i + 1}`, count: reached.get(p.id) ?? 0 });
    });
  }
  // Abgesendet: gemessene Absende-Ereignisse, mindestens aber nicht mehr als Aufrufe
  funnel.push({ id: "submit", label: "Abgesendet", count: counts.submitVisits });

  const sinceIso = since.toISOString();
  const daily = await db.execute<{ date: string; count: number }>(sql`
    select to_char(d, 'YYYY-MM-DD') as date, coalesce(c.n, 0)::int as count
    from generate_series(date_trunc('day', ${sinceIso}::timestamptz at time zone 'Europe/Berlin'), date_trunc('day', now() at time zone 'Europe/Berlin'), interval '1 day') d
    left join (
      select date_trunc('day', submitted_at at time zone 'Europe/Berlin') as day, count(*) as n
      from submissions where form_id = ${formId} and workspace_id = ${workspaceId} and submitted_at >= ${sinceIso}::timestamptz and status <> 'spam'
      group by 1
    ) c on c.day = d
    order by d`);

  // Verteilungen: aktuelle Version, neueste 5000 Antworten
  const recent = await db
    .select({ data: schema.submissions.data })
    .from(schema.submissions)
    .where(subWhere)
    .orderBy(desc(schema.submissions.submittedAt))
    .limit(5000);
  const distributions: Analytics["distributions"] = [];
  for (const { field, parent } of fieldIndex(def).values()) {
    if (parent || !CHOICE.has(field.type)) continue;
    const counter = new Map<string, number>();
    let total = 0;
    let sum = 0;
    for (const { data } of recent) {
      const v = data[field.id];
      if (v === undefined || v === null || v === "") continue;
      total++;
      const values = Array.isArray(v) ? v : [v];
      for (const x of values) {
        const label = formatValue(field, field.type === "multi_select" || field.type === "checkboxes" ? [x] : x);
        counter.set(label, (counter.get(label) ?? 0) + 1);
        if (field.type === "rating" && typeof x === "number") sum += x;
      }
    }
    // Feste Reihenfolge der Optionen beibehalten (Farbe/Position folgt der Option, nicht dem Rang)
    let order: string[] = [];
    if (field.type === "yes_no") order = ["Ja", "Nein"];
    else if (field.type === "rating") order = Array.from({ length: field.ratingMax ?? 5 }, (_, i) => formatValue(field, i + 1));
    else order = (field.options ?? []).map((o) => o.label);
    const rows = order.map((label) => ({ label, count: counter.get(label) ?? 0 }));
    for (const [label, count] of counter) if (!order.includes(label)) rows.push({ label, count });
    distributions.push({ fieldId: field.id, label: field.label || field.key, type: field.type, total, rows, average: field.type === "rating" && total ? sum / total : undefined });
  }

  const submissions = subs.n;
  return {
    days,
    views: counts.views,
    starts: counts.starts,
    submissions,
    /** Gemessene Abschlüsse (Browser-Ereignisse) – Basis für Quote und Trichter. */
    measuredSubmits: counts.submitVisits,
    completionRate: counts.starts ? Math.min(1, counts.submitVisits / counts.starts) : null,
    startRate: counts.views ? Math.min(1, counts.starts / counts.views) : null,
    medianMs: subs.median === null ? null : Number(subs.median),
    funnel,
    stepped,
    daily: [...daily].map((d) => ({ date: d.date, count: Number(d.count) })),
    distributions,
  };
}
