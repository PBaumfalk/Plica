/**
 * Statische Prüfung einer Formulardefinition für den Editor.
 * Findet Fehler, bevor ein Formular veröffentlicht wird:
 * ungültige Verweise, Zyklen, unmögliche Bedingungen, Widersprüche.
 */
import { ExprError, expressionRefs } from "./expr";
import { fieldIndex, isInputField, type Condition, type Field, type FormDefinition } from "./schema";
import { patternError } from "./validate";

export type Severity = "error" | "warning";
export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  /** Betroffenes Element: Feld-, Seiten- oder Regel-ID. */
  target?: string;
  ruleId?: string;
}

const NUMERIC_TYPES = new Set(["number", "currency", "rating", "slider", "calculated", "date", "datetime"]);
const CHOICE_TYPES = new Set(["dropdown", "single_choice", "multi_select", "checkboxes"]);

function describe(f: Field | undefined): string {
  return f ? `„${f.label || f.key}“` : "ein gelöschtes Feld";
}

/** Prüft, ob die Bedingungen einer UND-Regel nie gleichzeitig wahr sein können. */
function impossibleConjunction(conds: Condition[], index: Map<string, { field: Field }>): string | null {
  const byField = new Map<string, Condition[]>();
  for (const c of conds) byField.set(c.fieldId, [...(byField.get(c.fieldId) ?? []), c]);
  for (const [fid, list] of byField) {
    const field = index.get(fid)?.field;
    const multi = field && (field.type === "checkboxes" || field.type === "multi_select");
    // empty & not_empty
    if (list.some((c) => c.operator === "empty") && list.some((c) => c.operator !== "empty" && c.operator !== "neq" && c.operator !== "not_contains" && c.operator !== "not_in"))
      return `${describe(field)} kann nicht gleichzeitig leer und ausgefüllt sein.`;
    // zwei verschiedene eq-Werte bei Einfachauswahl
    if (!multi) {
      const eqs = [...new Set(list.filter((c) => c.operator === "eq").map((c) => String(c.value).toLowerCase()))];
      if (eqs.length > 1) return `${describe(field)} kann nicht gleichzeitig „${eqs[0]}“ und „${eqs[1]}“ sein.`;
      const eq = eqs[0];
      if (eq !== undefined && list.some((c) => c.operator === "neq" && String(c.value).toLowerCase() === eq))
        return `${describe(field)} kann nicht gleichzeitig „${eq}“ und nicht „${eq}“ sein.`;
    }
    // Zahlenbereich leer
    let lo = -Infinity;
    let hi = Infinity;
    let loIncl = true;
    let hiIncl = true;
    for (const c of list) {
      const n = typeof c.value === "number" ? c.value : Number(c.value);
      if (!Number.isFinite(n)) continue;
      if (c.operator === "gt" && n >= lo) { lo = n; loIncl = false; }
      if (c.operator === "gte" && n > lo) { lo = n; loIncl = true; }
      if (c.operator === "lt" && n <= hi) { hi = n; hiIncl = false; }
      if (c.operator === "lte" && n < hi) { hi = n; hiIncl = true; }
    }
    if (lo > hi || (lo === hi && !(loIncl && hiIncl))) return `Kein Wert für ${describe(field)} erfüllt alle Bedingungen.`;
  }
  return null;
}

export function analyze(def: FormDefinition): Issue[] {
  const issues: Issue[] = [];
  const index = fieldIndex(def);
  const pageIds = new Set(def.pages.map((p) => p.id));
  const pagePos = new Map(def.pages.map((p, i) => [p.id, i]));
  const endingIds = new Set(def.endings.map((e) => e.id));
  const keys = new Map<string, string>();

  // Felder
  for (const { field, parent } of index.values()) {
    if (isInputField(field)) {
      const prev = keys.get(field.key);
      if (prev) issues.push({ severity: "error", code: "duplicate_key", message: `Der Feldschlüssel „${field.key}“ ist doppelt vergeben.`, target: field.id });
      keys.set(field.key, field.id);
    }
    if (isInputField(field) && field.type !== "hidden" && field.type !== "calculated" && !field.label.trim())
      issues.push({ severity: "warning", code: "missing_label", message: "Ein Feld hat noch keine Frage.", target: field.id });
    if (CHOICE_TYPES.has(field.type)) {
      const opts = field.options ?? [];
      if (opts.length === 0) issues.push({ severity: "error", code: "no_options", message: `${describe(field)} hat keine Antwortmöglichkeiten.`, target: field.id });
      const values = opts.map((o) => o.value);
      if (new Set(values).size !== values.length) issues.push({ severity: "error", code: "duplicate_option", message: `${describe(field)} hat doppelte Antwortmöglichkeiten.`, target: field.id });
    }
    const v = field.validation;
    if (v?.pattern) {
      const err = patternError(v.pattern);
      if (err) issues.push({ severity: "error", code: "bad_pattern", message: `Das Prüfmuster von ${describe(field)} ist ungültig: ${err}`, target: field.id });
    }
    if (v?.min !== undefined && v?.max !== undefined && v.min > v.max)
      issues.push({ severity: "error", code: "min_gt_max", message: `Bei ${describe(field)} ist das Minimum größer als das Maximum.`, target: field.id });
    if (v?.minLength !== undefined && v?.maxLength !== undefined && v.minLength > v.maxLength)
      issues.push({ severity: "error", code: "minlen_gt_maxlen", message: `Bei ${describe(field)} ist die Mindestlänge größer als die Höchstlänge.`, target: field.id });
    if (parent && (field.type === "file" || field.type === "signature"))
      issues.push({ severity: "error", code: "media_in_group", message: "Datei-Uploads und Unterschriften sind in Wiederholgruppen nicht möglich.", target: field.id });
    if (field.type === "group" && parent)
      issues.push({ severity: "error", code: "nested_group", message: "Gruppen können nicht verschachtelt werden.", target: field.id });
    if (field.type === "consent" && !field.consentText?.trim() && !field.label.trim())
      issues.push({ severity: "error", code: "empty_consent", message: "Eine Einwilligung braucht einen Text.", target: field.id });
    if (field.type === "calculated") {
      if (!field.expression?.trim()) {
        issues.push({ severity: "warning", code: "empty_expression", message: `${describe(field)} hat noch keine Formel.`, target: field.id });
      } else {
        try {
          for (const ref of expressionRefs(field.expression)) {
            if (!keys.has(ref) && ![...index.values()].some((e) => e.field.key === ref))
              issues.push({ severity: "error", code: "bad_expr_ref", message: `Die Formel von ${describe(field)} verweist auf das unbekannte Feld {${ref}}.`, target: field.id });
          }
        } catch (e) {
          issues.push({ severity: "error", code: "bad_expression", message: `Die Formel von ${describe(field)} ist fehlerhaft: ${e instanceof ExprError ? e.message : "unbekannter Fehler"}`, target: field.id });
        }
      }
    }
  }

  // Abhängigkeitsgraph: Ziel hängt von Bedingungsfeldern ab.
  const deps = new Map<string, Set<string>>();
  const addDep = (target: string, on: string) => {
    if (!deps.has(target)) deps.set(target, new Set());
    deps.get(target)!.add(on);
  };

  for (const rule of def.rules) {
    if (rule.enabled === false) continue;
    const label = rule.name ? `Regel „${rule.name}“` : "Eine Regel";
    for (const c of rule.conditions) {
      const ref = index.get(c.fieldId);
      if (!ref) {
        issues.push({ severity: "error", code: "bad_condition_ref", message: `${label} prüft ein Feld, das es nicht mehr gibt.`, ruleId: rule.id });
        continue;
      }
      if (!isInputField(ref.field))
        issues.push({ severity: "error", code: "condition_on_display", message: `${label} prüft ${describe(ref.field)}, das keine Antwort hat.`, ruleId: rule.id });
      if (["gt", "gte", "lt", "lte"].includes(c.operator) && !NUMERIC_TYPES.has(ref.field.type))
        issues.push({ severity: "warning", code: "numeric_on_text", message: `${label} vergleicht ${describe(ref.field)} als Zahl, obwohl es Text ist.`, ruleId: rule.id });
      if (CHOICE_TYPES.has(ref.field.type) && (c.operator === "eq" || c.operator === "neq") && typeof c.value === "string") {
        const values = new Set((ref.field.options ?? []).map((o) => o.value.toLowerCase()));
        if (!values.has(c.value.toLowerCase()))
          issues.push({ severity: "error", code: "unknown_option", message: `${label} erwartet „${c.value}“, aber ${describe(ref.field)} bietet diese Antwort nicht an.`, ruleId: rule.id });
      }
      if (!["empty", "not_empty"].includes(c.operator) && (c.value === undefined || c.value === ""))
        issues.push({ severity: "warning", code: "missing_value", message: `${label} hat eine Bedingung ohne Vergleichswert.`, ruleId: rule.id });
    }
    if (rule.match === "all") {
      const msg = impossibleConjunction(rule.conditions, index);
      if (msg) issues.push({ severity: "error", code: "impossible", message: `${label} kann nie zutreffen: ${msg}`, ruleId: rule.id });
    }
    const condPages = rule.conditions.map((c) => pagePos.get(index.get(c.fieldId)?.page.id ?? "") ?? -1);
    for (const a of rule.actions) {
      if (a.type === "set_ending") {
        if (!endingIds.has(a.target)) issues.push({ severity: "error", code: "bad_ending", message: `${label} verweist auf eine gelöschte Abschlussseite.`, ruleId: rule.id });
        continue;
      }
      if (a.type === "skip_to") {
        if (!pageIds.has(a.target)) {
          issues.push({ severity: "error", code: "bad_page", message: `${label} springt zu einer gelöschten Seite.`, ruleId: rule.id });
          continue;
        }
        if ((pagePos.get(a.target) ?? 0) <= Math.max(...condPages))
          issues.push({ severity: "error", code: "backward_skip", message: `${label} springt zurück oder auf dieselbe Seite. Sprünge sind nur nach vorn möglich.`, ruleId: rule.id });
        continue;
      }
      const isPage = pageIds.has(a.target);
      const tf = index.get(a.target);
      if (!isPage && !tf) {
        issues.push({ severity: "error", code: "bad_target", message: `${label} steuert ein Element, das es nicht mehr gibt.`, ruleId: rule.id });
        continue;
      }
      for (const c of rule.conditions) {
        if (c.fieldId === a.target)
          issues.push({ severity: "error", code: "self_reference", message: `${label} macht ${describe(tf?.field)} von sich selbst abhängig.`, ruleId: rule.id });
        addDep(a.target, c.fieldId);
      }
      // Bedingungsfeld liegt auf einer Seite, die diese Regel ausblendet
      if (isPage && (a.type === "show" || a.type === "hide")) {
        const p = pagePos.get(a.target)!;
        if (condPages.includes(p))
          issues.push({ severity: "error", code: "page_self_reference", message: `${label} blendet die Seite aus, auf der ihre eigene Bedingung steht.`, ruleId: rule.id });
        for (const c of rule.conditions) {
          const cp = pagePos.get(index.get(c.fieldId)?.page.id ?? "") ?? -1;
          if (cp > p) issues.push({ severity: "warning", code: "future_condition", message: `${label} steuert eine Seite anhand einer Antwort, die erst später kommt.`, ruleId: rule.id });
        }
      }
      if (tf && !isPage && (a.type === "show" || a.type === "hide")) {
        const tp = pagePos.get(tf.page.id) ?? 0;
        if (condPages.some((cp) => cp > tp))
          issues.push({ severity: "warning", code: "future_condition", message: `${label} steuert ${describe(tf.field)} anhand einer Antwort, die erst später im Formular kommt.`, ruleId: rule.id });
      }
    }
  }

  // Widerspruch: gleiche Bedingungen zeigen und verbergen dasselbe Ziel
  const sig = (r: (typeof def.rules)[number]) => r.match + JSON.stringify([...r.conditions].sort((a, b) => (a.fieldId + a.operator).localeCompare(b.fieldId + b.operator)));
  for (let i = 0; i < def.rules.length; i++) {
    for (let j = i + 1; j < def.rules.length; j++) {
      const a = def.rules[i];
      const b = def.rules[j];
      if (a.enabled === false || b.enabled === false || sig(a) !== sig(b)) continue;
      for (const x of a.actions) for (const y of b.actions) {
        if (x.type !== "skip_to" && x.target === y.target && ((x.type === "show" && y.type === "hide") || (x.type === "hide" && y.type === "show")))
          issues.push({ severity: "error", code: "contradiction", message: "Zwei Regeln mit denselben Bedingungen zeigen und verbergen dasselbe Element.", ruleId: b.id });
      }
    }
  }

  // Berechnete Felder als Abhängigkeiten
  const byKey = new Map([...index.values()].map((e) => [e.field.key, e.field.id]));
  for (const { field } of index.values()) {
    if (field.type !== "calculated" || !field.expression) continue;
    try {
      for (const ref of expressionRefs(field.expression)) {
        const id = byKey.get(ref);
        if (id) addDep(field.id, id);
      }
    } catch {
      /* bereits oben gemeldet */
    }
  }

  // Zyklen (DFS)
  const state = new Map<string, 0 | 1 | 2>();
  const reported = new Set<string>();
  const stack: string[] = [];
  const visit = (n: string) => {
    state.set(n, 1);
    stack.push(n);
    for (const m of deps.get(n) ?? []) {
      if (state.get(m) === 1) {
        const cycle = stack.slice(stack.indexOf(m));
        const key = [...cycle].sort().join(",");
        if (!reported.has(key)) {
          reported.add(key);
          const names = cycle.map((id) => {
            const f = index.get(id)?.field;
            if (f) return f.label || f.key;
            const p = def.pages.find((pg) => pg.id === id);
            return p ? `Seite „${p.title || def.pages.indexOf(p) + 1}“` : id;
          });
          issues.push({ severity: "error", code: "cycle", message: `Zirkuläre Abhängigkeit: ${names.join(" → ")} → ${names[0]}.`, target: m });
        }
      } else if (!state.get(m)) visit(m);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const n of deps.keys()) if (!state.get(n)) visit(n);

  // Erste Seite darf nicht bedingt sein
  const first = def.pages[0];
  if (def.rules.some((r) => r.enabled !== false && r.actions.some((a) => a.target === first.id && (a.type === "show" || a.type === "hide"))))
    issues.push({ severity: "error", code: "first_page_conditional", message: "Die erste Seite kann nicht ausgeblendet werden.", target: first.id });

  // Endings
  for (const e of def.endings) {
    if (e.redirectUrl && !/^https?:\/\//i.test(e.redirectUrl))
      issues.push({ severity: "error", code: "bad_redirect", message: `Die Weiterleitung von „${e.title}“ muss mit http:// oder https:// beginnen.`, target: e.id });
  }

  if (![...index.values()].some((e) => isInputField(e.field)))
    issues.push({ severity: "warning", code: "no_inputs", message: "Das Formular enthält noch keine Frage." });
  else if (![...index.values()].some((e) => isInputField(e.field) && e.field.required) && !def.rules.some((r) => r.actions.some((a) => a.type === "require")))
    issues.push({ severity: "warning", code: "no_required", message: "Keine Frage ist Pflicht – das Formular kann leer abgeschickt werden." });

  return issues;
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
