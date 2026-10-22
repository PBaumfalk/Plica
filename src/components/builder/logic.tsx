"use client";
/**
 * Regel-Editor in Satzform: „Wenn … dann …“. Keine Programmierkenntnisse
 * nötig; Fehler aus der statischen Analyse erscheinen direkt an der Regel.
 */
import { AlertTriangle, GitBranch, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented, Switch } from "@/components/ui/controls";
import { Empty } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatValue } from "@/lib/forms/format";
import { FIELD_META, newId } from "@/lib/forms/fields";
import { fieldIndex, isInputField, type Action, type Condition, type Field, type FormDefinition, type Operator, type Rule } from "@/lib/forms/schema";
import { useBuilder } from "./context";
import { insInput, NativeSelect } from "./inspector-ui";

const OP_LABEL: Record<Operator, string> = {
  eq: "ist",
  neq: "ist nicht",
  contains: "enthält",
  not_contains: "enthält nicht",
  gt: "ist größer als",
  gte: "ist mindestens",
  lt: "ist kleiner als",
  lte: "ist höchstens",
  empty: "ist leer",
  not_empty: "ist ausgefüllt",
  in: "ist eine von",
  not_in: "ist keine von",
};
const DATE_LABEL: Partial<Record<Operator, string>> = { eq: "ist am", gt: "ist nach dem", lt: "ist vor dem", gte: "ist frühestens am", lte: "ist spätestens am" };

const NUMERIC = new Set(["number", "currency", "rating", "slider", "calculated"]);
const DATES = new Set(["date", "datetime"]);

export function operatorsFor(f: Field | undefined): Operator[] {
  if (!f) return ["not_empty", "empty"];
  if (NUMERIC.has(f.type)) return ["eq", "neq", "gt", "gte", "lt", "lte", "not_empty", "empty"];
  if (DATES.has(f.type)) return ["eq", "gt", "lt", "gte", "lte", "not_empty", "empty"];
  if (f.type === "dropdown" || f.type === "single_choice") return ["eq", "neq", "in", "not_in", "not_empty", "empty"];
  if (f.type === "multi_select" || f.type === "checkboxes") return ["contains", "not_contains", "in", "not_empty", "empty"];
  if (f.type === "yes_no" || f.type === "consent") return ["eq"];
  if (["short_text", "long_text", "email", "phone", "hidden"].includes(f.type)) return ["eq", "neq", "contains", "not_contains", "not_empty", "empty"];
  if (f.type === "name" || f.type === "address") return ["contains", "not_contains", "not_empty", "empty"];
  return ["not_empty", "empty"];
}

function opLabel(f: Field | undefined, op: Operator) {
  if (f && DATES.has(f.type)) return DATE_LABEL[op] ?? OP_LABEL[op];
  if (f?.type === "multi_select" || f?.type === "checkboxes") return op === "in" ? "enthält eine von" : OP_LABEL[op];
  return OP_LABEL[op];
}

function quote(s: string) {
  return `„${s}“`;
}

function valueText(f: Field | undefined, v: Condition["value"]): string {
  if (v === undefined || v === "") return "…";
  if (Array.isArray(v)) return v.map((x) => quote(f?.options?.find((o) => o.value === x)?.label ?? x)).join(", ");
  if (f?.type === "yes_no" || f?.type === "consent") return v === true || v === "true" ? "„Ja“" : "„Nein“";
  if (f && (f.type === "dropdown" || f.type === "single_choice" || f.type === "multi_select" || f.type === "checkboxes")) return quote(f.options?.find((o) => o.value === v)?.label ?? String(v));
  if (f && DATES.has(f.type)) return formatValue({ ...f, type: "date" }, v);
  return typeof v === "number" ? new Intl.NumberFormat("de-DE").format(v) : quote(String(v));
}

/** Kurze, lesbare Zusammenfassung einer Regel. */
export function describeRule(def: FormDefinition, r: Rule): string {
  const idx = fieldIndex(def);
  const name = (id: string) => {
    const f = idx.get(id)?.field;
    if (f) return quote(f.label || f.key);
    const pi = def.pages.findIndex((p) => p.id === id);
    if (pi >= 0) return `Seite ${pi + 1}${def.pages[pi].title ? ` ${quote(def.pages[pi].title)}` : ""}`;
    const e = def.endings.find((x) => x.id === id);
    return e ? quote(e.title) : "(gelöscht)";
  };
  const conds = r.conditions
    .map((c) => {
      const f = idx.get(c.fieldId)?.field;
      return `${name(c.fieldId)} ${opLabel(f, c.operator)}${c.operator === "empty" || c.operator === "not_empty" ? "" : ` ${valueText(f, c.value)}`}`;
    })
    .join(r.match === "all" ? " und " : " oder ");
  const acts = r.actions
    .map((a) => {
      switch (a.type) {
        case "show": return `zeige ${name(a.target)}`;
        case "hide": return `verberge ${name(a.target)}`;
        case "require": return `${name(a.target)} wird Pflicht`;
        case "skip_to": return `springe zu ${name(a.target)}`;
        case "set_ending": return `zeige Abschluss ${name(a.target)}`;
      }
    })
    .join(", ");
  return `Wenn ${conds}, ${acts}.`;
}

/** Neue Aktion: zeige das nächste Feld nach den Bedingungsfeldern (nie ein leeres Ziel). */
function defaultAction(def: FormDefinition, exclude: string[]): Action {
  const top = def.pages.flatMap((p) => p.fields);
  const lastSrc = Math.max(...exclude.map((id) => top.findIndex((f) => f.id === id)));
  const next = top.slice(lastSrc + 1).find((f) => !exclude.includes(f.id)) ?? top.find((f) => !exclude.includes(f.id));
  if (next) return { type: "show", target: next.id };
  return { type: "set_ending", target: def.endings[0].id };
}

export function LogicPanel() {
  const { state, api, focusRule, setFocusRule } = useBuilder();
  const def = state.def;
  const sources = [...fieldIndex(def).values()].filter((e) => !e.parent && isInputField(e.field) && !["group", "file", "signature"].includes(e.field.type)).map((e) => e.field);

  const add = () => {
    const src = sources[0];
    if (!src) return;
    const id = newId("r_");
    api.mutate((d) => void d.rules.push({ id, enabled: true, match: "all", conditions: [{ fieldId: src.id, operator: operatorsFor(src)[0], value: src.options?.[0]?.value ?? (src.type === "yes_no" ? true : undefined) }], actions: [defaultAction(d, [src.id])] }));
    setFocusRule(id);
  };

  if (def.rules.length === 0) {
    return (
      <Empty icon={<GitBranch />} title="Noch keine Regeln" action={sources.length ? <Button size="sm" variant="primary" onClick={add}><Plus /> Regel anlegen</Button> : undefined}>
        {sources.length
          ? "Mit Regeln zeigst du Fragen nur bei Bedarf, überspringst Seiten oder wählst je nach Antwort eine andere Abschlussseite."
          : "Lege zuerst Fragen an – Regeln reagieren auf Antworten."}
      </Empty>
    );
  }
  return (
    <div className="space-y-3 p-3">
      {def.rules.map((r, i) => (
        <RuleCard key={r.id} rule={r} index={i} focused={focusRule === r.id} onFocused={() => setFocusRule(null)} />
      ))}
      <Button size="sm" onClick={add} className="w-full justify-center" disabled={!sources.length}><Plus /> Regel hinzufügen</Button>
    </div>
  );
}

function RuleCard({ rule, index, focused, onFocused }: { rule: Rule; index: number; focused: boolean; onFocused: () => void }) {
  const { state, api, issues } = useBuilder();
  const def = state.def;
  const ref = useRef<HTMLDivElement>(null);
  const idx = fieldIndex(def);
  const sources = [...idx.values()].filter((e) => !e.parent && isInputField(e.field) && !["group", "file", "signature"].includes(e.field.type)).map((e) => e.field);
  const ruleIssues = issues.filter((i) => i.ruleId === rule.id);

  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    ref.current?.querySelector<HTMLElement>("select")?.focus();
    onFocused();
  }, [focused, onFocused]);

  const edit = (fn: (r: Rule) => void, key?: string) =>
    api.mutate((d) => {
      const r = d.rules.find((x) => x.id === rule.id);
      if (r) fn(r);
    }, key);

  return (
    <div ref={ref} className={cn("rounded-lg border bg-paper p-3 transition-shadow", ruleIssues.some((i) => i.severity === "error") ? "border-bad/50" : "border-line", rule.enabled === false && "opacity-60")}>
      <div className="mb-2.5 flex items-center gap-2">
        <input value={rule.name ?? ""} onChange={(e) => edit((r) => void (r.name = e.target.value || undefined), `rule-name:${rule.id}`)} placeholder={`Regel ${index + 1}`} aria-label="Name der Regel" className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-ink-2" />
        <Switch checked={rule.enabled !== false} onCheckedChange={(b) => edit((r) => void (r.enabled = b))} label="Regel aktiv" />
        <button type="button" aria-label="Regel löschen" onClick={() => api.mutate((d) => void (d.rules = d.rules.filter((r) => r.id !== rule.id)))} className="rounded-sm p-1 text-faint hover:bg-desk-2 hover:text-bad">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
          <span>Wenn</span>
          {rule.conditions.length > 1 ? (
            <Segmented label="Verknüpfung" size="sm" value={rule.match} onChange={(m) => edit((r) => void (r.match = m))} options={[{ value: "all", label: "alle" }, { value: "any", label: "eine" }]} />
          ) : null}
          {rule.conditions.length > 1 && <span>zutreffen</span>}
        </div>
        {rule.conditions.map((c, ci) => (
          <ConditionRow key={ci} c={c} sources={sources} idx={idx} canRemove={rule.conditions.length > 1}
            onChange={(next) => edit((r) => void (r.conditions[ci] = next), `rule-cond:${rule.id}:${ci}`)}
            onRemove={() => edit((r) => void r.conditions.splice(ci, 1))}
            joiner={ci > 0 ? (rule.match === "all" ? "und" : "oder") : null}
          />
        ))}
        <button type="button" onClick={() => edit((r) => { const s = sources[0]; r.conditions.push({ fieldId: s.id, operator: operatorsFor(s)[0], value: s.options?.[0]?.value }); })} className="flex items-center gap-1 text-[12px] font-medium text-stamp hover:underline">
          <Plus className="size-3" /> Bedingung
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-dashed border-line pt-3">
        <div className="text-[12.5px] font-medium text-muted">Dann</div>
        {rule.actions.map((a, ai) => (
          <ActionRow key={ai} a={a} def={def} canRemove={rule.actions.length > 1} onChange={(next) => edit((r) => void (r.actions[ai] = next))} onRemove={() => edit((r) => void r.actions.splice(ai, 1))} />
        ))}
        <button type="button" onClick={() => edit((r) => void r.actions.push(defaultAction(def, r.conditions.map((c) => c.fieldId))))} className="flex items-center gap-1 text-[12px] font-medium text-stamp hover:underline">
          <Plus className="size-3" /> Aktion
        </button>
      </div>

      {ruleIssues.length > 0 && (
        <ul className="mt-3 space-y-1">
          {ruleIssues.map((i, n) => (
            <li key={n} className={cn("flex items-start gap-1.5 text-[12px] leading-snug", i.severity === "error" ? "text-bad" : "text-warn")}>
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {i.message}
            </li>
          ))}
        </ul>
      )}
      {ruleIssues.length === 0 && <p className="mt-3 rounded-md bg-paper-2 px-2 py-1.5 text-[12px] leading-snug text-muted">{describeRule(def, rule)}</p>}
    </div>
  );
}

function ConditionRow({ c, sources, idx, onChange, onRemove, canRemove, joiner }: { c: Condition; sources: Field[]; idx: ReturnType<typeof fieldIndex>; onChange: (c: Condition) => void; onRemove: () => void; canRemove: boolean; joiner: string | null }) {
  const f = idx.get(c.fieldId)?.field;
  const ops = operatorsFor(f);
  const needsValue = c.operator !== "empty" && c.operator !== "not_empty";
  return (
    <div className="relative space-y-1.5 rounded-md bg-paper-2 p-2">
      {joiner && <span className="absolute -top-2.5 left-2 rounded-xs bg-paper px-1 text-[11px] font-medium text-muted">{joiner}</span>}
      <div className="flex gap-1.5">
        <NativeSelect
          value={f ? c.fieldId : ""}
          onChange={(id) => {
            const nf = idx.get(id)?.field;
            const op = operatorsFor(nf)[0];
            onChange({ fieldId: id, operator: op, value: nf?.options?.[0]?.value ?? (nf?.type === "yes_no" || nf?.type === "consent" ? true : undefined) });
          }}
          options={[...(f ? [] : [{ value: "", label: "Feld wählen …" }]), ...sources.map((s) => ({ value: s.id, label: s.label || FIELD_META[s.type].label }))]}
        />
        {canRemove && (
          <button type="button" aria-label="Bedingung entfernen" onClick={onRemove} className="grid size-8 shrink-0 place-items-center rounded-sm text-faint hover:bg-desk-2 hover:text-bad">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <div className={needsValue ? "w-[45%] shrink-0" : "flex-1"}>
          <NativeSelect value={c.operator} onChange={(op) => onChange({ ...c, operator: op, value: op === "in" || op === "not_in" ? (Array.isArray(c.value) ? c.value : c.value !== undefined ? [String(c.value)] : []) : Array.isArray(c.value) ? c.value[0] : c.value })} options={ops.map((o) => ({ value: o, label: opLabel(f, o) }))} />
        </div>
        {needsValue && <div className="min-w-0 flex-1"><ValueInput f={f} c={c} onChange={onChange} /></div>}
      </div>
    </div>
  );
}

function ValueInput({ f, c, onChange }: { f: Field | undefined; c: Condition; onChange: (c: Condition) => void }) {
  if (!f) return null;
  if (f.type === "yes_no" || f.type === "consent") {
    return <NativeSelect value={c.value === false || c.value === "false" ? "false" : "true"} onChange={(v) => onChange({ ...c, value: v === "true" })} options={[{ value: "true", label: f.type === "consent" ? "zugestimmt" : "Ja" }, { value: "false", label: f.type === "consent" ? "nicht zugestimmt" : "Nein" }]} />;
  }
  if (f.options?.length) {
    if (c.operator === "in" || c.operator === "not_in") {
      const arr = Array.isArray(c.value) ? c.value : [];
      return (
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-line bg-paper p-1.5">
          {f.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-[12.5px]">
              <Checkbox checked={arr.includes(o.value)} onCheckedChange={(b) => onChange({ ...c, value: b ? [...arr, o.value] : arr.filter((x) => x !== o.value) })} label={o.label} />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    return <NativeSelect value={typeof c.value === "string" ? c.value : ""} onChange={(v) => onChange({ ...c, value: v })} options={[...(typeof c.value === "string" && f.options.some((o) => o.value === c.value) ? [] : [{ value: "", label: "Antwort wählen …" }]), ...f.options.map((o) => ({ value: o.value, label: o.label }))]} />;
  }
  if (NUMERIC.has(f.type)) {
    return (
      <input
        inputMode="decimal"
        aria-label="Vergleichswert"
        value={c.value === undefined ? "" : String(c.value).replace(".", ",")}
        onChange={(e) => {
          const t = e.target.value.trim();
          const n = Number(t.replace(/\./g, "").replace(",", "."));
          onChange({ ...c, value: t === "" ? undefined : Number.isFinite(n) ? n : t });
        }}
        className={cn(insInput, "tabular-nums")}
        placeholder="Zahl"
      />
    );
  }
  if (DATES.has(f.type)) {
    return <input type="date" aria-label="Vergleichsdatum" value={typeof c.value === "string" ? c.value.slice(0, 10) : ""} onChange={(e) => onChange({ ...c, value: e.target.value || undefined })} className={insInput} />;
  }
  return <input aria-label="Vergleichswert" value={typeof c.value === "string" ? c.value : ""} onChange={(e) => onChange({ ...c, value: e.target.value })} className={insInput} placeholder="Text" />;
}

type ActionKind = "show-field" | "hide-field" | "show-page" | "hide-page" | "require" | "skip_to" | "set_ending";

function ActionRow({ a, def, onChange, onRemove, canRemove }: { a: Action; def: FormDefinition; onChange: (a: Action) => void; onRemove: () => void; canRemove: boolean }) {
  const idx = fieldIndex(def);
  const isPage = def.pages.some((p) => p.id === a.target);
  const kind: ActionKind = a.type === "show" ? (isPage ? "show-page" : "show-field") : a.type === "hide" ? (isPage ? "hide-page" : "hide-field") : a.type;
  const fields = [...idx.values()].filter((e) => !e.parent).map((e) => e.field);
  const inputs = fields.filter((f) => isInputField(f) && f.type !== "calculated" && f.type !== "hidden");
  const pages = def.pages.map((p, i) => ({ value: p.id, label: `Seite ${i + 1}${p.title ? `: ${p.title}` : ""}` }));
  const targets =
    kind === "show-field" || kind === "hide-field"
      ? fields.map((f) => ({ value: f.id, label: f.label || FIELD_META[f.type].label }))
      : kind === "require"
        ? inputs.map((f) => ({ value: f.id, label: f.label || FIELD_META[f.type].label }))
        : kind === "set_ending"
          ? def.endings.map((e) => ({ value: e.id, label: e.title }))
          : pages.slice(kind === "show-page" || kind === "hide-page" ? 1 : 0);
  const setKind = (k: ActionKind) => {
    const type = k === "show-field" || k === "show-page" ? "show" : k === "hide-field" || k === "hide-page" ? "hide" : k;
    const pageKind = k === "show-page" || k === "hide-page" || k === "skip_to";
    const keep = pageKind ? def.pages.some((p) => p.id === a.target) : k === "set_ending" ? def.endings.some((e) => e.id === a.target) : idx.has(a.target);
    const fallback = pageKind ? def.pages[1]?.id ?? def.pages[0].id : k === "set_ending" ? def.endings[0].id : (k === "require" ? inputs[0]?.id : fields[0]?.id) ?? a.target;
    onChange({ type, target: keep ? a.target : fallback } as Action);
  };
  return (
    <div className="flex items-start gap-1.5 rounded-md bg-paper-2 p-2">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <NativeSelect<ActionKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: "show-field", label: "Zeige Feld" },
            { value: "hide-field", label: "Verberge Feld" },
            { value: "require", label: "Mache zum Pflichtfeld" },
            { value: "show-page", label: "Zeige Seite", disabled: def.pages.length < 2 },
            { value: "hide-page", label: "Verberge Seite", disabled: def.pages.length < 2 },
            { value: "skip_to", label: "Springe zu Seite", disabled: def.pages.length < 2 },
            { value: "set_ending", label: "Zeige Abschlussseite" },
          ]}
        />
        <NativeSelect value={targets.some((t) => t.value === a.target) ? a.target : ""} onChange={(t) => onChange({ ...a, target: t } as Action)} options={[...(targets.some((t) => t.value === a.target) ? [] : [{ value: "", label: "Ziel wählen …" }]), ...targets]} />
      </div>
      {canRemove && (
        <button type="button" aria-label="Aktion entfernen" onClick={onRemove} className="grid size-8 shrink-0 place-items-center rounded-sm text-faint hover:bg-desk-2 hover:text-bad">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
