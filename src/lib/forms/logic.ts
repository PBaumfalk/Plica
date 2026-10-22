/**
 * Regel-Engine. Läuft identisch im Browser (Live-Verhalten) und auf dem
 * Server (verbindliche Prüfung beim Absenden).
 *
 * Semantik:
 * - Ein Ziel (Feld oder Seite), das von einer aktiven „show“-Regel
 *   adressiert wird, ist standardmäßig verborgen und erscheint, sobald
 *   eine dieser Regeln zutrifft. „hide“ gewinnt immer.
 * - „skip_to“ überspringt alle Seiten zwischen der Seite der zuletzt
 *   abgefragten Bedingung und dem Ziel (nur vorwärts).
 * - Antworten verborgener Felder zählen als leer und werden beim
 *   Speichern verworfen.
 */
import { evaluateSafe, type Value } from "./expr";
import { toNumber } from "./number";
import {
  fieldIndex,
  isInputField,
  type Condition,
  type Ending,
  type Field,
  type FormDefinition,
  type Rule,
} from "./schema";

export type Answers = Record<string, unknown>;

export interface FormState {
  /** Felder (inkl. Gruppenkinder), die logisch vorhanden sind. */
  visible: Set<string>;
  /** Seiten in der Reihenfolge, in der sie durchlaufen werden. */
  pages: string[];
  required: Set<string>;
  ending: Ending;
  /** Ergebnisse berechneter Felder, nach Feld-ID. */
  computed: Record<string, Value>;
}

export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).every(isEmpty);
  return false;
}

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(asText).join(" ");
  return String(v);
}

function norm(v: unknown): string {
  return asText(v).trim().toLocaleLowerCase("de");
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    // ISO-Datum/Zeit vergleichbar machen
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
      return Number.isNaN(t) ? null : t;
    }
    // Gleiche Lesart wie die Server-Validierung („20.000“ = 20000)
    return toNumber(v);
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
}

/** Vergleichswert aus der Bedingung passend zum Antworttyp interpretieren. */
function cmpValue(v: Condition["value"]): unknown {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  return v;
}

export function evalCondition(c: Condition, answer: unknown): boolean {
  const list = Array.isArray(answer) ? answer.map(norm) : null;
  const target = c.value;
  switch (c.operator) {
    case "empty": return isEmpty(answer);
    case "not_empty": return !isEmpty(answer);
    case "eq":
      if (typeof answer === "boolean") return answer === (target === true || target === "true" || target === "yes");
      if (list) return list.includes(norm(target));
      if (typeof answer === "number" || typeof target === "number") return num(answer) !== null && num(answer) === num(target);
      return norm(answer) === norm(target);
    case "neq": return !evalCondition({ ...c, operator: "eq" }, answer);
    case "contains":
      if (list) return list.includes(norm(target));
      return norm(answer).includes(norm(target));
    case "not_contains": return !evalCondition({ ...c, operator: "contains" }, answer);
    case "in":
    case "not_in": {
      const set = (Array.isArray(target) ? target : [target]).map(norm);
      const hit = list ? list.some((x) => set.includes(x)) : set.includes(norm(answer));
      return c.operator === "in" ? hit : !hit;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = num(answer);
      const b = num(cmpValue(target));
      if (a === null || b === null) return false;
      return c.operator === "gt" ? a > b : c.operator === "gte" ? a >= b : c.operator === "lt" ? a < b : a <= b;
    }
  }
}

export function ruleMatches(rule: Rule, get: (fieldId: string) => unknown): boolean {
  const results = rule.conditions.map((c) => evalCondition(c, get(c.fieldId)));
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

/** Wert eines Feldes für Ausdrücke: Gruppenkinder liefern Listen. */
function exprValue(field: Field, raw: unknown): Value {
  if (raw === undefined || raw === null) return null;
  if (field.type === "yes_no") return raw === true ? 1 : raw === false ? 0 : null;
  if (field.type === "number" || field.type === "currency" || field.type === "rating" || field.type === "slider") {
    const n = num(raw);
    return n;
  }
  if (Array.isArray(raw)) return raw.map((x) => (typeof x === "object" ? asText(x) : (x as Value)));
  if (typeof raw === "object") return asText(raw);
  return raw as Value;
}

export function computeState(def: FormDefinition, answers: Answers): FormState {
  const index = fieldIndex(def);
  const byKey = new Map<string, Field>();
  for (const { field } of index.values()) byKey.set(field.key, field);
  const rules = def.rules.filter((r) => r.enabled !== false);

  const showTargets = new Set<string>();
  for (const r of rules) for (const a of r.actions) if (a.type === "show") showTargets.add(a.target);

  const pageOrder = def.pages.map((p) => p.id);
  const pagePos = new Map(pageOrder.map((id, i) => [id, i]));

  let visible = new Set<string>();
  let pages: string[] = [];
  let required = new Set<string>();
  let endingId = def.endings[0].id;
  let computed: Record<string, Value> = {};

  // Fixpunkt-Iteration: Sichtbarkeit beeinflusst Bedingungen und umgekehrt.
  // Zyklen erkennt der Analyzer im Editor; hier begrenzen wir hart.
  let prevSig = "";
  for (let iter = 0; iter < 8; iter++) {
    const get = (fieldId: string): unknown => {
      if (iter > 0 && !visible.has(fieldId)) return undefined;
      if (fieldId in computed) return computed[fieldId];
      return answers[fieldId];
    };

    // 1. berechnete Felder
    const nextComputed: Record<string, Value> = {};
    for (const { field, parent } of index.values()) {
      if (field.type !== "calculated" || !field.expression || parent) continue;
      nextComputed[field.id] = evaluateSafe(field.expression, (key) => {
        const ref = byKey.get(key);
        if (!ref) return null;
        const entry = index.get(ref.id)!;
        if (entry.parent) {
          // Kind einer Wiederholgruppe -> Liste über alle Einträge
          const items = get(entry.parent.id);
          if (!Array.isArray(items)) return [];
          return items.map((it) => exprValue(ref, (it as Answers)?.[ref.id]) ?? null);
        }
        if (ref.type === "calculated") return computed[ref.id] ?? null;
        return exprValue(ref, get(ref.id));
      });
    }
    computed = nextComputed;

    // 2. Regeln auswerten
    const shown = new Set<string>();
    const hidden = new Set<string>();
    const req = new Set<string>();
    const skipped = new Set<string>();
    let ending = def.endings[0].id;
    for (const rule of rules) {
      if (!ruleMatches(rule, get)) continue;
      for (const a of rule.actions) {
        if (a.type === "show") shown.add(a.target);
        else if (a.type === "hide") hidden.add(a.target);
        else if (a.type === "require") req.add(a.target);
        else if (a.type === "set_ending") ending = a.target;
        else if (a.type === "skip_to") {
          const from = Math.max(...rule.conditions.map((c) => pagePos.get(index.get(c.fieldId)?.page.id ?? "") ?? -1));
          const to = pagePos.get(a.target);
          if (to !== undefined && from >= 0 && to > from) for (let i = from + 1; i < to; i++) skipped.add(pageOrder[i]);
        }
      }
    }
    const on = (id: string) => !hidden.has(id) && (!showTargets.has(id) || shown.has(id));

    // 3. Sichtbarkeit ableiten
    const nextPages = def.pages.filter((p) => on(p.id) && !skipped.has(p.id)).map((p) => p.id);
    const pageSet = new Set(nextPages);
    const nextVisible = new Set<string>();
    for (const { field, page, parent } of index.values()) {
      if (!pageSet.has(page.id) || !on(field.id)) continue;
      if (parent && !on(parent.id)) continue;
      nextVisible.add(field.id);
    }
    const nextRequired = new Set<string>();
    for (const { field } of index.values()) {
      if (!nextVisible.has(field.id) || !isInputField(field)) continue;
      if (field.type === "calculated" || field.type === "hidden") continue;
      if (field.required || req.has(field.id)) nextRequired.add(field.id);
    }

    visible = nextVisible;
    pages = nextPages;
    required = nextRequired;
    endingId = ending;

    const sig = [...visible].sort().join(",") + "|" + pages.join(",") + "|" + [...required].sort().join(",") + "|" + endingId + "|" + JSON.stringify(computed);
    if (sig === prevSig) break;
    prevSig = sig;
  }

  const ending = def.endings.find((e) => e.id === endingId) ?? def.endings[0];
  return { visible, pages, required, ending, computed };
}

/** {{key}}-Platzhalter mit Antworten füllen (für Labels, Abschlussseiten, E-Mails). */
export function interpolate(
  text: string,
  def: FormDefinition,
  answers: Answers,
  format: (field: Field, value: unknown) => string,
): string {
  if (!text.includes("{{")) return text;
  const byKey = new Map<string, Field>();
  for (const { field } of fieldIndex(def).values()) byKey.set(field.key, field);
  let emptied = false;
  const out = text.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_, key: string) => {
    const f = byKey.get(key);
    const v = f ? format(f, answers[f.id]) : "";
    if (!v) emptied = true;
    return v;
  });
  // Leere Platzhalter ohne Satzzeichen-Reste: „Worum geht es, ?“ → „Worum geht es?“
  return emptied ? out.replace(/\s+([,.!?;:])/g, "$1").replace(/,([.!?])/g, "$1").replace(/ {2,}/g, " ").trim() : out;
}
