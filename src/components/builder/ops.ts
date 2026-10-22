/**
 * Reine Operationen auf der Formulardefinition. Jede Funktion bekommt einen
 * bereits geklonten Entwurf und verändert ihn direkt (siehe store.ts).
 */
import { allKeys, cloneField, createField, newId } from "@/lib/forms/fields";
import type { Field, FieldType, FormDefinition, Page } from "@/lib/forms/schema";

export interface Located {
  field: Field;
  page: Page;
  pageIndex: number;
  /** Liste, in der das Feld liegt (Seite oder Gruppe) */
  list: Field[];
  index: number;
  parent?: Field;
}

export function locate(def: FormDefinition, id: string): Located | null {
  for (let pi = 0; pi < def.pages.length; pi++) {
    const page = def.pages[pi];
    for (let i = 0; i < page.fields.length; i++) {
      const f = page.fields[i];
      if (f.id === id) return { field: f, page, pageIndex: pi, list: page.fields, index: i };
      if (f.type === "group" && f.fields) {
        const ci = f.fields.findIndex((c) => c.id === id);
        if (ci >= 0) return { field: f.fields[ci], page, pageIndex: pi, list: f.fields, index: ci, parent: f };
      }
    }
  }
  return null;
}

/** Container-Schlüssel: „page:<id>“ oder „group:<id>“ */
export type ContainerKey = `page:${string}` | `group:${string}`;

export function containerList(def: FormDefinition, key: ContainerKey): Field[] | null {
  const [kind, id] = key.split(":") as ["page" | "group", string];
  if (kind === "page") return def.pages.find((p) => p.id === id)?.fields ?? null;
  const g = locate(def, id);
  if (!g || g.field.type !== "group") return null;
  g.field.fields ??= [];
  return g.field.fields;
}

export function containerOf(def: FormDefinition, id: string): ContainerKey | null {
  const l = locate(def, id);
  if (!l) return null;
  return l.parent ? `group:${l.parent.id}` : `page:${l.page.id}`;
}

const NOT_IN_GROUP = new Set<FieldType>(["group", "file", "signature"]);
export const canLiveInGroup = (f: Pick<Field, "type">) => !NOT_IN_GROUP.has(f.type);

export function insertField(def: FormDefinition, field: Field, target: ContainerKey, index: number): boolean {
  if (target.startsWith("group:") && !canLiveInGroup(field)) return false;
  const list = containerList(def, target);
  if (!list) return false;
  list.splice(Math.max(0, Math.min(index, list.length)), 0, field);
  return true;
}

export function newField(def: FormDefinition, type: FieldType, overrides: Partial<Field> = {}): Field {
  return createField(type, allKeys(def), overrides);
}

/** Verweise auf entfernte Elemente aus Regeln tilgen, leere Regeln löschen. */
export function pruneRules(def: FormDefinition, removed: Set<string>) {
  def.rules = def.rules
    .map((r) => ({
      ...r,
      conditions: r.conditions.filter((c) => !removed.has(c.fieldId)),
      actions: r.actions.filter((a) => !removed.has(a.target)),
    }))
    .filter((r) => r.conditions.length > 0 && r.actions.length > 0);
}

export function removeFields(def: FormDefinition, ids: string[]) {
  const removed = new Set<string>();
  for (const id of ids) {
    const l = locate(def, id);
    if (!l) continue;
    l.list.splice(l.index, 1);
    removed.add(id);
    for (const c of l.field.fields ?? []) removed.add(c.id);
  }
  pruneRules(def, removed);
}

export function moveField(def: FormDefinition, id: string, target: ContainerKey, index: number): boolean {
  const l = locate(def, id);
  if (!l) return false;
  if (target === `group:${id}`) return false;
  if (target.startsWith("group:") && !canLiveInGroup(l.field)) return false;
  const from = l.parent ? `group:${l.parent.id}` : `page:${l.page.id}`;
  const [f] = l.list.splice(l.index, 1);
  let at = index;
  if (from === target && l.index < index) at -= 1;
  const list = containerList(def, target);
  if (!list) {
    l.list.splice(l.index, 0, f);
    return false;
  }
  list.splice(Math.max(0, Math.min(at, list.length)), 0, f);
  return true;
}

/** Ein Feld eine Position nach oben/unten – über Seitengrenzen hinweg. */
export function nudge(def: FormDefinition, id: string, dir: -1 | 1): boolean {
  const l = locate(def, id);
  if (!l) return false;
  const next = l.index + dir;
  if (next >= 0 && next < l.list.length) {
    l.list.splice(l.index, 1);
    l.list.splice(next, 0, l.field);
    return true;
  }
  if (l.parent) return false;
  const pi = l.pageIndex + dir;
  if (pi < 0 || pi >= def.pages.length) return false;
  l.list.splice(l.index, 1);
  const target = def.pages[pi].fields;
  if (dir === 1) target.unshift(l.field);
  else target.push(l.field);
  return true;
}

/**
 * Mehrere Felder gemeinsam klonen: Verweise der Felder untereinander
 * (Formeln {schluessel}, Platzhalter {{schluessel}}) zeigen danach auf die Kopien.
 */
export function cloneFieldSet(fields: Field[], taken: Set<string>): Field[] {
  const copies = fields.map((f) => cloneField(f, taken));
  const map = new Map<string, string>();
  const collect = (a: Field, b: Field) => {
    if (a.key !== b.key) map.set(a.key, b.key);
    (a.fields ?? []).forEach((c, i) => b.fields && collect(c, b.fields[i]));
  };
  fields.forEach((f, i) => collect(f, copies[i]));
  if (!map.size) return copies;
  const rewrite = (f: Field) => {
    if (f.expression) f.expression = f.expression.replace(/\{\s*([a-z][a-z0-9_]*)\s*\}/g, (m, k: string) => (map.has(k) ? `{${map.get(k)}}` : m));
    f.label = f.label.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (m, k: string) => (map.has(k) ? `{{${map.get(k)}}}` : m));
    f.fields?.forEach(rewrite);
  };
  copies.forEach(rewrite);
  return copies;
}

export function duplicateFields(def: FormDefinition, ids: string[]): string[] {
  const taken = allKeys(def);
  const located = ids.map((id) => locate(def, id)).filter((x): x is Located => !!x);
  const copies = cloneFieldSet(located.map((l) => l.field), taken);
  const created: string[] = [];
  // von hinten, damit Indizes stimmen
  const order = located.map((l, i) => ({ l, copy: copies[i] })).sort((a, b) => b.l.index - a.l.index);
  for (const { l, copy } of order) {
    copy.label = l.field.label ? `${l.field.label} (Kopie)` : l.field.label;
    l.list.splice(l.index + 1, 0, copy);
    created.unshift(copy.id);
  }
  return created;
}

/** Ausgewählte Felder einer Seite in eine Wiederholgruppe verschieben. */
export function groupFields(def: FormDefinition, ids: string[]): string | null {
  const located = ids.map((id) => locate(def, id)).filter((x): x is Located => !!x && !x.parent);
  if (!located.length) return null;
  const pageId = located[0].page.id;
  if (located.some((l) => l.page.id !== pageId)) return null;
  if (located.some((l) => !canLiveInGroup(l.field))) return null;
  located.sort((a, b) => a.index - b.index);
  const group = newField(def, "group", { label: "Einträge", fields: [] });
  const page = located[0].page;
  const at = located[0].index;
  for (const l of [...located].reverse()) page.fields.splice(l.index, 1);
  group.fields = located.map((l) => l.field);
  page.fields.splice(at, 0, group);
  return group.id;
}

/** Gruppe auflösen: Kinder an ihre Stelle setzen. */
export function ungroup(def: FormDefinition, groupId: string): boolean {
  const l = locate(def, groupId);
  if (!l || l.field.type !== "group" || l.parent) return false;
  l.list.splice(l.index, 1, ...(l.field.fields ?? []));
  pruneRules(def, new Set([groupId]));
  return true;
}

export function addPage(def: FormDefinition, afterIndex: number): string {
  const page: Page = { id: newId("p_"), title: "", fields: [] };
  def.pages.splice(afterIndex + 1, 0, page);
  return page.id;
}

export function removePage(def: FormDefinition, pageId: string): boolean {
  if (def.pages.length <= 1) return false;
  const i = def.pages.findIndex((p) => p.id === pageId);
  if (i < 0) return false;
  const [p] = def.pages.splice(i, 1);
  const removed = new Set<string>([p.id]);
  for (const f of p.fields) {
    removed.add(f.id);
    for (const c of f.fields ?? []) removed.add(c.id);
  }
  pruneRules(def, removed);
  return true;
}

/** Seitenumbruch entfernen: Felder der Seite an die vorige anhängen. */
export function mergeWithPrevious(def: FormDefinition, pageId: string): boolean {
  const i = def.pages.findIndex((p) => p.id === pageId);
  if (i <= 0) return false;
  const [p] = def.pages.splice(i, 1);
  def.pages[i - 1].fields.push(...p.fields);
  pruneRules(def, new Set([p.id]));
  return true;
}

export function movePage(def: FormDefinition, pageId: string, dir: -1 | 1): boolean {
  const i = def.pages.findIndex((p) => p.id === pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= def.pages.length) return false;
  [def.pages[i], def.pages[j]] = [def.pages[j], def.pages[i]];
  return true;
}

/** Alle Felder in Anzeigereihenfolge (für Pfeiltasten-Navigation). */
export function flatOrder(def: FormDefinition): string[] {
  const out: string[] = [];
  for (const p of def.pages)
    for (const f of p.fields) {
      out.push(f.id);
      for (const c of f.fields ?? []) out.push(c.id);
    }
  return out;
}

/** IDs aller Felder/Seiten, auf die Regeln wirken oder von denen sie abhängen. */
export function logicMarks(def: FormDefinition): { targets: Set<string>; sources: Set<string> } {
  const targets = new Set<string>();
  const sources = new Set<string>();
  for (const r of def.rules) {
    if (r.enabled === false) continue;
    for (const c of r.conditions) sources.add(c.fieldId);
    for (const a of r.actions) targets.add(a.target);
  }
  return { targets, sources };
}
