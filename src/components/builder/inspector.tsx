"use client";
import { AlertTriangle, Blocks, Check, Copy, GitBranch, Group, ImageUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { evaluate, ExprError, expressionRefs, parseExpression } from "@/lib/forms/expr";
import { allKeys, FIELD_META, newId, slugKey } from "@/lib/forms/fields";
import { fieldIndex, isInputField, type Field, type FieldType, type FormDefinition, type Rule, type Validation } from "@/lib/forms/schema";
import { compilePattern, patternError, resolveDate } from "@/lib/forms/validate";
import { saveBlockAction } from "@/server/actions/blocks";
import { useBuilder, type Panel } from "./context";
import { DesignPanel, EndingsPanel } from "./panels";
import { FieldIcon } from "./field-icons";
import { insInput, NativeSelect, NumIn, Row, Section, TextIn, Toggle } from "./inspector-ui";
import { describeRule, LogicPanel } from "./logic";
import { locate } from "./ops";
import { OptionsEditor } from "./options-editor";
import { selectedFieldIds } from "./store";

export function Inspector() {
  const { panel, setPanel, issues, state } = useBuilder();
  const ruleErrors = issues.filter((i) => i.ruleId && i.severity === "error").length;
  const tabs: { value: Panel; label: string; badge?: number }[] = [
    { value: "field", label: "Feld" },
    { value: "logic", label: "Regeln", badge: state.def.rules.length || undefined },
    { value: "endings", label: "Abschluss" },
    { value: "design", label: "Design" },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Eigenschaften" className="flex shrink-0 gap-1 border-b border-line px-3">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={panel === t.value}
            onClick={() => setPanel(t.value)}
            className={cn("relative flex h-11 items-center gap-1.5 px-2 text-[13px] transition-colors", panel === t.value ? "font-medium text-ink after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-stamp" : "text-muted hover:text-ink")}
          >
            {t.label}
            {t.badge !== undefined && <span className={cn("rounded-full px-1.5 text-[10.5px] tabular-nums", t.value === "logic" && ruleErrors ? "bg-bad text-white" : "bg-desk-2 text-muted")}>{t.badge}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {panel === "field" && <SelectionInspector />}
        {panel === "logic" && <LogicPanel />}
        {panel === "endings" && <EndingsPanel />}
        {panel === "design" && <DesignPanel />}
      </div>
    </div>
  );
}

function SelectionInspector() {
  const { state } = useBuilder();
  const sel = state.selection;
  const ids = selectedFieldIds(sel);
  if (ids.length > 1) return <MultiInspector ids={ids} />;
  if (ids.length === 1) {
    const l = locate(state.def, ids[0]);
    return l ? <FieldInspector key={l.field.id} field={l.field} inGroup={!!l.parent} /> : <FormInspector />;
  }
  if (sel?.kind === "page") {
    const i = state.def.pages.findIndex((p) => p.id === sel.id);
    if (i >= 0) return <PageInspector key={sel.id} index={i} />;
  }
  return <FormInspector />;
}

/* ---------- Hilfen ---------- */

function useFieldUpdate(id: string) {
  const { api } = useBuilder();
  return (patch: Partial<Field>, coalesce?: string) =>
    api.mutate(
      (d) => {
        const l = locate(d, id);
        if (!l) return;
        Object.assign(l.field, patch);
        for (const k of Object.keys(patch) as (keyof Field)[]) if (patch[k] === undefined) delete l.field[k];
      },
      coalesce ?? `f:${id}:${Object.keys(patch).join(",")}`,
    );
}

function cleanValidation(v: Validation): Validation | undefined {
  const out = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== "")) as Validation;
  return Object.keys(out).length ? out : undefined;
}

const TYPE_FAMILIES: FieldType[][] = [
  ["short_text", "long_text", "email", "phone"],
  ["dropdown", "single_choice", "multi_select", "checkboxes"],
  ["number", "currency", "slider"],
  ["date", "datetime"],
  ["heading", "paragraph"],
];

const ACCEPT: { mime: string; label: string }[] = [
  { mime: "application/pdf", label: "PDF" },
  { mime: "image/jpeg", label: "JPG" },
  { mime: "image/png", label: "PNG" },
  { mime: "image/webp", label: "WebP" },
  { mime: "image/heic", label: "HEIC (iPhone)" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (DOCX)" },
  { mime: "application/vnd.oasis.opendocument.text", label: "ODT" },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel (XLSX)" },
  { mime: "text/plain", label: "Text" },
  { mime: "text/csv", label: "CSV" },
];

const PATTERN_PRESETS = [
  { label: "Postleitzahl (DE)", pattern: "^[0-9]{5}$", message: "Bitte eine fünfstellige Postleitzahl eingeben." },
  { label: "IBAN", pattern: "^[A-Z]{2}[0-9]{2}[A-Z0-9 ]{11,40}$", message: "Bitte eine gültige IBAN eingeben." },
  { label: "Vorgangsnummer (2026-0042)", pattern: "^[0-9]{4}-[0-9]{1,6}$", message: "Bitte im Format 2026-0042 angeben." },
  { label: "Nur Buchstaben", pattern: "^[\\p{L} .'-]+$", message: "Bitte nur Buchstaben verwenden." },
];

/* ---------- Formular / Seite / Mehrfachauswahl ---------- */

function FormInspector() {
  const { state, api, openQuickInsert } = useBuilder();
  const def = state.def;
  const inputs = [...fieldIndex(def).values()].filter((e) => isInputField(e.field)).length;
  return (
    <div>
      <Section title="Formular">
        <TextIn label="Titel" value={def.title} onChange={(v) => api.mutate((d) => void (d.title = v), "title")} />
        <TextIn label="Einleitung" multiline value={def.description} onChange={(v) => api.mutate((d) => void (d.description = v || undefined), "description")} placeholder="Wofür ist das Formular, was passiert danach?" />
        <p className="text-[12.5px] text-muted">
          {def.pages.length} {def.pages.length === 1 ? "Seite" : "Seiten"} · {inputs} {inputs === 1 ? "Frage" : "Fragen"} · {def.rules.length} {def.rules.length === 1 ? "Regel" : "Regeln"}
        </p>
      </Section>
      <Section title="So geht’s">
        <ul className="space-y-2 text-[13px] text-ink-2">
          <li>Felder aus der linken Spalte auf das Blatt ziehen – oder <kbd className="rounded-xs border border-line px-1 font-mono text-[11px]">/</kbd> drücken.</li>
          <li>Ein Feld anklicken, um es hier zu bearbeiten. Mit <kbd className="rounded-xs border border-line px-1 font-mono text-[11px]">⇧</kbd> mehrere auswählen.</li>
          <li>Der <span className="font-mono text-[11.5px] uppercase tracking-wider">Falz</span> zwischen zwei Blättern ist ein Seitenumbruch.</li>
        </ul>
        <Button size="sm" onClick={openQuickInsert}><Plus /> Feld einfügen</Button>
      </Section>
    </div>
  );
}

function PageInspector({ index }: { index: number }) {
  const { state, api, setPanel, setFocusRule } = useBuilder();
  const page = state.def.pages[index];
  const rules = state.def.rules.filter((r) => r.actions.some((a) => a.target === page.id));
  return (
    <div>
      <Section title={`Seite ${index + 1}`}>
        <TextIn label="Titel" value={page.title} onChange={(v) => api.mutate((d) => void (d.pages[index].title = v), `page-title:${page.id}`)} placeholder="z. B. Ihre Kontaktdaten" />
        <TextIn label="Beschreibung" multiline value={page.description} onChange={(v) => api.mutate((d) => void (d.pages[index].description = v || undefined), `page-desc:${page.id}`)} />
        <SaveAsBlockButton fields={page.fields} label="Seite als Baustein speichern" defaultName={page.title || `Seite ${index + 1}`} />
      </Section>
      {index > 0 && (
        <Section title="Sichtbarkeit">
          {rules.map((r) => (
            <RuleLink key={r.id} rule={r} />
          ))}
          <Button
            size="sm"
            onClick={() => {
              const id = createVisibilityRule(api, state.def, page.id, true);
              if (!id) return void toast.error("Für eine Bedingung braucht es vorher eine Frage auf einer früheren Seite.");
              setFocusRule(id);
              setPanel("logic");
            }}
          >
            <GitBranch /> Seite nur zeigen, wenn …
          </Button>
        </Section>
      )}
    </div>
  );
}

function MultiInspector({ ids }: { ids: string[] }) {
  const { state, api, duplicateSelection, deleteSelection, groupSelection } = useBuilder();
  const fields = ids.map((id) => locate(state.def, id)?.field).filter((f): f is Field => !!f);
  return (
    <Section title={`${fields.length} Felder ausgewählt`}>
      <ul className="space-y-1">
        {fields.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-[13px]">
            <FieldIcon type={f.type} className="size-3.5 text-muted" /> <span className="truncate">{f.label || FIELD_META[f.type].label}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" onClick={duplicateSelection}><Copy /> Duplizieren</Button>
        <Button size="sm" onClick={groupSelection}><Group /> Gruppieren</Button>
        <Button size="sm" onClick={() => api.mutate((d) => ids.forEach((id) => { const l = locate(d, id); if (l && isInputField(l.field) && l.field.type !== "calculated" && l.field.type !== "hidden") l.field.required = true; }))}><Check /> Alle Pflicht</Button>
        <Button size="sm" variant="ghost" className="text-bad" onClick={deleteSelection}><Trash2 /> Löschen</Button>
      </div>
      <SaveAsBlockButton fields={fields} label="Als Baustein speichern" defaultName="" />
    </Section>
  );
}

function SaveAsBlockButton({ fields, label, defaultName }: { fields: Field[]; label: string; defaultName: string }) {
  const { blocks, setBlocks } = useBuilder();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="ghost" disabled={!fields.length} onClick={() => (setName(defaultName), setError(null), setOpen(true))}><Blocks /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Als Baustein speichern" description={`${fields.length} ${fields.length === 1 ? "Feld" : "Felder"} lassen sich danach in jedes Formular dieses Workspace einfügen.`}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveBlockAction({ name, description: description || undefined, fields: JSON.parse(JSON.stringify(fields)) });
                if (!r.ok) return setError(r.fieldErrors?.name ?? r.error);
                setBlocks([r.data, ...blocks]);
                setOpen(false);
                toast(`Baustein „${r.data.name}“ gespeichert`);
              });
            }}
          >
            <TextIn label="Name" value={name} onChange={setName} placeholder="z. B. Anschrift mit Kontakt" error={error} />
            <TextIn label="Beschreibung (optional)" value={description} onChange={setDescription} />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button type="submit" variant="primary" loading={pending}>Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Sichtbarkeitsregeln ---------- */

function previousInputs(def: FormDefinition, targetId: string): Field[] {
  const out: Field[] = [];
  for (const p of def.pages) {
    if (p.id === targetId) return out;
    for (const f of p.fields) {
      if (f.id === targetId) return out;
      if (isInputField(f) && f.type !== "group" && f.type !== "file" && f.type !== "signature") out.push(f);
    }
  }
  return out;
}

export function createVisibilityRule(api: ReturnType<typeof useBuilder>["api"], def: FormDefinition, targetId: string, isPage = false): string | null {
  const prev = previousInputs(def, targetId);
  const src = [...prev].reverse().find((f) => f.options?.length || f.type === "yes_no") ?? prev[prev.length - 1];
  if (!src) return null;
  const id = newId("r_");
  const value = src.options?.length ? src.options[0].value : src.type === "yes_no" ? true : undefined;
  const rule: Rule = {
    id,
    enabled: true,
    match: "all",
    conditions: [{ fieldId: src.id, operator: value === undefined ? "not_empty" : "eq", value }],
    actions: [{ type: "show", target: targetId }],
  };
  void isPage;
  api.mutate((d) => void d.rules.push(rule));
  return id;
}

function RuleLink({ rule }: { rule: Rule }) {
  const { state, setPanel, setFocusRule } = useBuilder();
  return (
    <button type="button" onClick={() => (setFocusRule(rule.id), setPanel("logic"))} className="flex w-full items-start gap-2 rounded-md border border-stamp-line bg-stamp-soft/50 px-2.5 py-2 text-left text-[12.5px] leading-snug text-ink-2 hover:border-stamp">
      <GitBranch className="mt-0.5 size-3.5 shrink-0 text-stamp" />
      <span className={cn(rule.enabled === false && "line-through opacity-60")}>{describeRule(state.def, rule)}</span>
    </button>
  );
}

/* ---------- Einzelnes Feld ---------- */

function FieldInspector({ field, inGroup }: { field: Field; inGroup: boolean }) {
  const { state, api, issuesByTarget, setPanel, setFocusRule, openMobilePanel, slug, status } = useBuilder();
  const def = state.def;
  const upd = useFieldUpdate(field.id);
  const v = field.validation ?? {};
  const updV = (patch: Partial<Validation>) => upd({ validation: cleanValidation({ ...v, ...patch }) }, `f:${field.id}:v:${Object.keys(patch).join()}`);
  const meta = FIELD_META[field.type];
  const input = isInputField(field);
  const family = TYPE_FAMILIES.find((f) => f.includes(field.type));
  const issues = issuesByTarget.get(field.id) ?? [];
  const rules = def.rules.filter((r) => r.actions.some((a) => a.target === field.id));
  const textual = ["short_text", "long_text", "email", "phone", "hidden"].includes(field.type);
  const numeric = ["number", "currency", "slider"].includes(field.type);
  const choice = ["dropdown", "single_choice", "multi_select", "checkboxes"].includes(field.type);
  const multi = field.type === "multi_select" || field.type === "checkboxes";

  const renameOptionValue = (from: string, to: string) =>
    api.mutate((d) => {
      for (const r of d.rules) for (const c of r.conditions) if (c.fieldId === field.id) {
        if (c.value === from) c.value = to;
        if (Array.isArray(c.value)) c.value = c.value.map((x) => (x === from ? to : x));
      }
    }, `f:${field.id}:options`);

  return (
    <div>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-stamp-soft text-stamp"><FieldIcon type={field.type} className="size-4" /></span>
        <div className="min-w-0 flex-1">
          {family && family.length > 1 ? (
            <NativeSelect
              value={field.type}
              onChange={(t) => upd(convertType(field, t))}
              options={family.map((t) => ({ value: t, label: FIELD_META[t].label }))}
            />
          ) : (
            <div className="text-[13.5px] font-medium">{meta.label}</div>
          )}
        </div>
        <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => openMobilePanel(null)}>Fertig</Button>
      </div>
      {issues.length > 0 && (
        <ul className="space-y-1 border-b border-line bg-warn-soft/50 px-4 py-2.5">
          {issues.map((i, n) => (
            <li key={n} className={cn("flex items-start gap-2 text-[12.5px] leading-snug", i.severity === "error" ? "text-bad" : "text-warn")}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {i.message}
            </li>
          ))}
        </ul>
      )}

      <Section title="Inhalt">
        {field.type === "paragraph" ? (
          <TextIn id="insp-label" label="Text" multiline rows={5} value={field.description ?? field.label} onChange={(t) => upd({ description: t, label: field.label || "" }, `f:${field.id}:desc`)} placeholder="Erklärender Text …" />
        ) : field.type !== "divider" ? (
          <TextIn id="insp-label" label={field.type === "heading" ? "Überschrift" : field.type === "image" ? "Beschriftung (optional)" : "Frage"} value={field.label} onChange={(t) => upd(labelPatch(def, field, t, status === "draft"), `f:${field.id}:label`)} placeholder={input ? "Was möchtest du wissen?" : ""} hint={input ? <>Mit <span className="font-mono">{"{{schluessel}}"}</span> frühere Antworten einsetzen.</> : undefined} />
        ) : (
          <p className="text-[13px] text-muted">Eine Trennlinie hat keine Einstellungen.</p>
        )}
        {field.type !== "paragraph" && field.type !== "divider" && field.type !== "image" && (
          <TextIn label="Hilfetext" multiline rows={2} value={field.description} onChange={(t) => upd({ description: t || undefined }, `f:${field.id}:desc`)} placeholder="Optionaler Hinweis unter der Frage" />
        )}
        {field.type === "heading" && (
          <Row label="Größe">
            <Segmented label="Größe der Überschrift" size="sm" value={String(field.level ?? 2) as "1" | "2" | "3"} onChange={(l) => upd({ level: Number(l) as 1 | 2 | 3 })} options={[{ value: "1", label: "Groß" }, { value: "2", label: "Mittel" }, { value: "3", label: "Klein" }]} />
          </Row>
        )}
        {field.type === "image" && <ImageSettings field={field} upd={upd} />}
        {(textual && field.type !== "hidden") || field.type === "dropdown" || numeric ? (
          <TextIn label="Platzhalter" value={field.placeholder} onChange={(t) => upd({ placeholder: t || undefined }, `f:${field.id}:ph`)} />
        ) : null}
      </Section>

      {choice && (
        <Section title="Antworten">
          <OptionsEditor options={field.options ?? []} onChange={(o) => upd({ options: o }, `f:${field.id}:options`)} onValueRenamed={renameOptionValue} />
          <Toggle label="„Sonstiges“ mit Freitext erlauben" checked={!!field.allowOther} onChange={(b) => upd({ allowOther: b || undefined })} />
          {multi && (
            <div className="grid grid-cols-2 gap-2">
              <NumIn label="Mindestens" value={v.minSelected} min={0} step={1} onChange={(n) => updV({ minSelected: n })} />
              <NumIn label="Höchstens" value={v.maxSelected} min={1} step={1} onChange={(n) => updV({ maxSelected: n })} />
            </div>
          )}
        </Section>
      )}

      {field.type === "matrix" && field.matrix && (
        <Section title="Matrix">
          <OptionsEditor label="Zeilen (Aussagen)" noun="Zeile" options={field.matrix.rows} onChange={(rows) => upd({ matrix: { ...field.matrix!, rows } }, `f:${field.id}:mrows`)} />
          <OptionsEditor label="Spalten (Antworten)" noun="Spalte" options={field.matrix.columns} onChange={(columns) => upd({ matrix: { ...field.matrix!, columns } }, `f:${field.id}:mcols`)} />
          <Toggle label="Mehrere Antworten pro Zeile" checked={field.matrix.multiple} onChange={(b) => upd({ matrix: { ...field.matrix!, multiple: b } })} />
        </Section>
      )}

      {field.type === "name" && (
        <Section title="Bestandteile">
          <PartsPicker
            all={[["title", "Anrede/Titel"], ["first", "Vorname"], ["middle", "Zweiter Vorname"], ["last", "Nachname"], ["suffix", "Zusatz"]]}
            value={field.nameParts ?? ["first", "last"]}
            onChange={(p) => upd({ nameParts: p as Field["nameParts"] })}
          />
        </Section>
      )}
      {field.type === "address" && (
        <Section title="Bestandteile">
          <PartsPicker
            all={[["street", "Straße und Hausnummer"], ["line2", "Adresszusatz"], ["postalCode", "PLZ"], ["city", "Ort"], ["state", "Bundesland"], ["country", "Land"]]}
            value={field.addressParts ?? ["street", "postalCode", "city", "country"]}
            onChange={(p) => upd({ addressParts: p as Field["addressParts"] })}
          />
          <TextIn label="Vorbelegtes Land" value={field.defaultCountry} onChange={(t) => upd({ defaultCountry: t || undefined }, `f:${field.id}:country`)} />
        </Section>
      )}
      {field.type === "rating" && (
        <Section title="Bewertung">
          <NumIn label="Höchstwert (3–10)" value={field.ratingMax ?? 5} min={3} max={10} step={1} onChange={(n) => n && upd({ ratingMax: n })} />
          <Row label="Darstellung">
            <Segmented label="Symbol" size="sm" value={field.ratingIcon ?? "star"} onChange={(i) => upd({ ratingIcon: i })} options={[{ value: "star", label: "Sterne" }, { value: "heart", label: "Herzen" }, { value: "number", label: "Zahlen" }]} />
          </Row>
        </Section>
      )}
      {field.type === "slider" && (
        <Section title="Skala">
          <div className="grid grid-cols-3 gap-2">
            <NumIn label="Von" value={v.min ?? 0} onChange={(n) => updV({ min: n })} />
            <NumIn label="Bis" value={v.max ?? 100} onChange={(n) => updV({ max: n })} />
            <NumIn label="Schritt" value={v.step ?? 1} min={0.001} onChange={(n) => updV({ step: n })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextIn label="Beschriftung links" value={field.sliderLabels?.[0]} onChange={(t) => upd({ sliderLabels: t || field.sliderLabels?.[1] ? [t, field.sliderLabels?.[1] ?? ""] : undefined }, `f:${field.id}:sl`)} placeholder="z. B. gar nicht" />
            <TextIn label="rechts" value={field.sliderLabels?.[1]} onChange={(t) => upd({ sliderLabels: t || field.sliderLabels?.[0] ? [field.sliderLabels?.[0] ?? "", t] : undefined }, `f:${field.id}:sr`)} placeholder="z. B. sehr" />
          </div>
        </Section>
      )}
      {field.type === "file" && (
        <Section title="Dateien">
          <Row label="Erlaubte Dateitypen" hint="PLICA prüft den Inhalt jeder Datei, nicht nur die Endung.">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {ACCEPT.map((a) => {
                const on = (field.accept ?? []).includes(a.mime);
                return (
                  <label key={a.mime} className="flex items-center gap-2 text-[12.5px]">
                    <Checkbox checked={on} onCheckedChange={(b) => upd({ accept: b ? [...(field.accept ?? []), a.mime] : (field.accept ?? []).filter((m) => m !== a.mime) })} label={a.label} />
                    {a.label}
                  </label>
                );
              })}
            </div>
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <NumIn label="Anzahl Dateien" value={field.maxFiles ?? 1} min={1} max={20} step={1} onChange={(n) => n && upd({ maxFiles: n })} />
            <NumIn label="Max. Größe (MB)" value={field.maxFileSizeMb ?? 10} min={0.1} max={100} onChange={(n) => n && upd({ maxFileSizeMb: n })} />
          </div>
        </Section>
      )}
      {field.type === "consent" && (
        <Section title="Einwilligungstext">
          <TextIn label="Wortlaut" multiline rows={5} value={field.consentText} onChange={(t) => upd({ consentText: t }, `f:${field.id}:consent`)} hint="Der genaue Wortlaut wird mit jeder Antwort gespeichert." />
        </Section>
      )}
      {field.type === "signature" && (
        <Section title="Unterschrift">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Einfache elektronische Unterschrift mit Zeitstempel, Formularversion und Prüfsumme. Sie ersetzt keine qualifizierte elektronische Signatur nach eIDAS.
          </p>
        </Section>
      )}
      {field.type === "calculated" && <FormulaSettings field={field} def={def} upd={upd} />}
      {field.type === "hidden" && (
        <Section title="Wert aus dem Link">
          <TextIn label="URL-Parameter" mono value={field.urlParam} onChange={(t) => upd({ urlParam: t.replace(/[^A-Za-z0-9_-]/g, "") || undefined }, `f:${field.id}:url`)} hint={field.urlParam ? <>Beispiel: <span className="break-all font-mono">/f/{slug}?{field.urlParam}=newsletter</span></> : "Ohne Parameter bleibt das Feld leer."} />
        </Section>
      )}
      {field.type === "group" && (
        <Section title="Wiederholung">
          <TextIn label="Bezeichnung eines Eintrags" value={field.itemLabel} onChange={(t) => upd({ itemLabel: t || undefined }, `f:${field.id}:item`)} placeholder="z. B. Begleitperson" />
          <div className="grid grid-cols-2 gap-2">
            <NumIn label="Mindestens" value={field.minItems} min={0} max={50} step={1} onChange={(n) => upd({ minItems: n })} />
            <NumIn label="Höchstens" value={field.maxItems} min={1} max={50} step={1} onChange={(n) => upd({ maxItems: n })} />
          </div>
          <p className="text-[12px] text-muted">Datei-Uploads und Unterschriften sind in Wiederholgruppen nicht möglich.</p>
        </Section>
      )}

      {input && field.type !== "calculated" && (
        <Section title="Eingabe">
          {field.type !== "hidden" && <Toggle label="Pflichtfeld" checked={!!field.required} onChange={(b) => upd({ required: b || undefined })} />}
          {!inGroup && field.type !== "hidden" && field.type !== "group" && (
            <Row label="Breite">
              <Segmented label="Breite" size="sm" value={field.width ?? "full"} onChange={(w) => upd({ width: w === "full" ? undefined : w })} options={[{ value: "full", label: "Ganze Zeile" }, { value: "half", label: "Halbe Zeile" }]} />
            </Row>
          )}
          <DefaultValue field={field} upd={upd} />
        </Section>
      )}

      {(textual || numeric || field.type === "date" || field.type === "datetime" || field.type === "date_range") && field.type !== "hidden" && (
        <Section title="Prüfung" defaultOpen={!!field.validation}>
          {textual && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <NumIn label="Min. Zeichen" value={v.minLength} min={0} step={1} onChange={(n) => updV({ minLength: n })} />
                <NumIn label="Max. Zeichen" value={v.maxLength} min={1} step={1} onChange={(n) => updV({ maxLength: n })} />
              </div>
              {field.type !== "email" && <PatternEditor field={field} updV={updV} upd={upd} />}
            </>
          )}
          {(field.type === "number" || field.type === "currency") && (
            <div className="grid grid-cols-2 gap-2">
              <NumIn label="Minimum" value={v.min} onChange={(n) => updV({ min: n })} />
              <NumIn label="Maximum" value={v.max} onChange={(n) => updV({ max: n })} />
              {field.type === "number" && <NumIn label="Nachkommastellen" value={field.decimals} min={0} max={6} step={1} onChange={(n) => upd({ decimals: n })} />}
              {field.type === "currency" && (
                <NativeSelect label="Währung" value={field.currency ?? "EUR"} onChange={(c) => upd({ currency: c })} options={["EUR", "CHF", "USD", "GBP"].map((c) => ({ value: c, label: c }))} />
              )}
            </div>
          )}
          {(field.type === "date" || field.type === "datetime" || field.type === "date_range") && (
            <div className="grid grid-cols-2 gap-2">
              <DateLimit label="Frühestens" value={v.minDate} onChange={(s) => updV({ minDate: s })} />
              <DateLimit label="Spätestens" value={v.maxDate} onChange={(s) => updV({ maxDate: s })} />
            </div>
          )}
        </Section>
      )}

      {input && field.type !== "calculated" && field.type !== "hidden" && (
        <Section title="Fehlermeldungen" defaultOpen={!!field.messages}>
          <TextIn label="Wenn leer" value={field.messages?.required} onChange={(t) => upd({ messages: msg(field, { required: t || undefined }) }, `f:${field.id}:m1`)} placeholder="Bitte ausfüllen." />
          <TextIn label="Wenn ungültig" value={field.messages?.invalid} onChange={(t) => upd({ messages: msg(field, { invalid: t || undefined }) }, `f:${field.id}:m2`)} placeholder="Standardmeldung je nach Feldtyp" />
        </Section>
      )}

      {!inGroup && (
        <Section title="Sichtbarkeit" id="insp-visibility" defaultOpen>
          {rules.length === 0 && <p className="text-[12.5px] text-muted">Immer sichtbar.</p>}
          {rules.map((r) => (
            <RuleLink key={r.id} rule={r} />
          ))}
          <Button
            size="sm"
            onClick={() => {
              const id = createVisibilityRule(api, def, field.id);
              if (!id) return void toast.error("Für eine Bedingung braucht es vorher eine andere Frage.");
              setFocusRule(id);
              setPanel("logic");
            }}
          >
            <GitBranch /> Nur zeigen, wenn …
          </Button>
        </Section>
      )}

      {input && <KeyEditor field={field} def={def} />}

      <div className="flex flex-wrap gap-1 px-4 py-3">
        <SaveAsBlockButton fields={[field]} label="Als Baustein speichern" defaultName={field.label} />
      </div>
    </div>
  );
}

/**
 * Solange ein Formular nie veröffentlicht wurde und der Schlüssel noch
 * automatisch aus der Frage stammt, wandert er mit der Frage mit.
 */
function labelPatch(def: FormDefinition, field: Field, label: string, neverPublished: boolean): Partial<Field> {
  if (!neverPublished || !isInputField(field)) return { label };
  const taken = allKeys(def);
  taken.delete(field.key);
  const auto = [slugKey(field.label, new Set(), field.type), slugKey(FIELD_META[field.type].label, new Set(), field.type)];
  const isAuto = auto.some((a) => field.key === a || new RegExp(`^${a}_\\d+$`).test(field.key));
  if (!isAuto || !label.trim()) return { label };
  const key = slugKey(label, taken, field.type);
  const usedInFormula = [...fieldIndex(def).values()].some((e) => e.field.expression?.includes(`{${field.key}}`));
  return usedInFormula ? { label } : { label, key };
}

function msg(field: Field, patch: NonNullable<Field["messages"]>) {
  const m = Object.fromEntries(Object.entries({ ...field.messages, ...patch }).filter(([, x]) => x));
  return Object.keys(m).length ? m : undefined;
}

function convertType(field: Field, to: FieldType): Partial<Field> {
  const patch: Partial<Field> = { type: to };
  const multi = (t: FieldType) => t === "multi_select" || t === "checkboxes";
  if (multi(field.type) !== multi(to)) patch.defaultValue = undefined;
  if (to === "slider" && (field.validation?.min === undefined || field.validation?.max === undefined)) patch.validation = { ...field.validation, min: field.validation?.min ?? 0, max: field.validation?.max ?? 10, step: field.validation?.step ?? 1 };
  if (to === "currency") Object.assign(patch, { currency: field.currency ?? "EUR", decimals: 2 });
  if (to === "email" || to === "phone") patch.validation = field.validation?.pattern ? { ...field.validation, pattern: undefined } : field.validation;
  return patch;
}

function PartsPicker({ all, value, onChange }: { all: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      {all.map(([k, label]) => (
        <label key={k} className="flex items-center gap-2 text-[13px]">
          <Checkbox
            checked={value.includes(k)}
            onCheckedChange={(b) => {
              const next = all.map(([x]) => x).filter((x) => (x === k ? b : value.includes(x)));
              if (next.length) onChange(next);
            }}
            label={label}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function DateLimit({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const resolved = value ? resolveDate(value) : null;
  return (
    <Row label={label} error={value && !resolved ? "Datum (JJJJ-MM-TT) oder z. B. today, +30d, -18y" : null} hint={resolved && resolved !== value ? `entspricht heute ${resolved.split("-").reverse().join(".")}` : undefined}>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value.trim() || undefined)} placeholder="z. B. today" className={cn(insInput, "font-mono text-[12.5px]")} aria-invalid={!!value && !resolved} list="date-presets" />
      <datalist id="date-presets">
        <option value="today">heute</option>
        <option value="+30d">in 30 Tagen</option>
        <option value="-18y">vor 18 Jahren (Volljährigkeit)</option>
        <option value="+1y">in einem Jahr</option>
      </datalist>
    </Row>
  );
}

function PatternEditor({ field, updV, upd }: { field: Field; updV: (p: Partial<Validation>) => void; upd: (p: Partial<Field>, k?: string) => void }) {
  const [sample, setSample] = useState("");
  const pattern = field.validation?.pattern ?? "";
  const err = pattern ? patternError(pattern) : null;
  const re = pattern && !err ? compilePattern(pattern) : null;
  const match = re && sample ? re.matcher(sample).find() : null;
  return (
    <div className="space-y-2 rounded-md bg-paper-2 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink-2">Format (regulärer Ausdruck)</span>
        <select
          aria-label="Vorlage für Format"
          value=""
          onChange={(e) => {
            const p = PATTERN_PRESETS.find((x) => x.label === e.target.value);
            if (p) {
              updV({ pattern: p.pattern });
              upd({ messages: msg(field, { pattern: p.message }) });
            }
          }}
          className="h-6 rounded-sm bg-transparent text-[12px] text-stamp"
        >
          <option value="">Vorlage …</option>
          {PATTERN_PRESETS.map((p) => (
            <option key={p.label}>{p.label}</option>
          ))}
        </select>
      </div>
      <input value={pattern} onChange={(e) => updV({ pattern: e.target.value || undefined })} placeholder="^[0-9]{5}$" aria-label="Regulärer Ausdruck" aria-invalid={!!err} className={cn(insInput, "font-mono text-[12.5px]")} />
      {err && <p className="text-[12px] text-bad">Ungültiger Ausdruck: {err}</p>}
      {pattern && !err && (
        <>
          <div className="flex items-center gap-2">
            <input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Testeingabe" aria-label="Testeingabe für das Format" className={cn(insInput, "h-7 flex-1 text-[12.5px]")} />
            {sample && (match ? <span className="inline-flex items-center gap-1 text-[12px] text-ok"><Check className="size-3.5" /> passt</span> : <span className="inline-flex items-center gap-1 text-[12px] text-bad"><X className="size-3.5" /> passt nicht</span>)}
          </div>
          <TextIn label="Meldung bei falschem Format" value={field.messages?.pattern} onChange={(t) => upd({ messages: msg(field, { pattern: t || undefined }) }, `f:${field.id}:mp`)} placeholder="Das Format passt nicht." />
          <p className="text-[11.5px] text-faint">Läuft mit RE2: auch komplizierte Ausdrücke können den Server nicht lahmlegen.</p>
        </>
      )}
    </div>
  );
}

function FormulaSettings({ field, def, upd }: { field: Field; def: FormDefinition; upd: (p: Partial<Field>, k?: string) => void }) {
  const expr = field.expression ?? "";
  const candidates = useMemo(() => [...fieldIndex(def).values()].map((e) => e.field).filter((f) => f.id !== field.id && isInputField(f) && f.type !== "group" && f.type !== "file" && f.type !== "signature"), [def, field.id]);
  const keys = new Set(candidates.map((c) => c.key));
  let error: string | null = null;
  let sample: string | null = null;
  let unknown: string[] = [];
  if (expr.trim()) {
    try {
      const ast = parseExpression(expr);
      unknown = expressionRefs(expr).filter((r) => !keys.has(r));
      const result = evaluate(ast, (k) => {
        const f = candidates.find((c) => c.key === k);
        if (!f) return null;
        return ["number", "currency", "slider", "rating", "calculated"].includes(f.type) ? 10 : f.type === "yes_no" ? 1 : "Text";
      });
      sample = result === null ? "–" : typeof result === "number" ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 4 }).format(result) : String(result);
    } catch (e) {
      error = e instanceof ExprError ? e.message : "Fehler in der Formel";
    }
  }
  const insert = (k: string) => upd({ expression: `${expr}${expr && !expr.endsWith(" ") ? " " : ""}{${k}}` }, `f:${field.id}:expr`);
  return (
    <Section title="Formel">
      <Row label="Berechnung" error={error ?? (unknown.length ? `Unbekannt: ${unknown.map((u) => `{${u}}`).join(", ")}` : null)} hint="Rechenzeichen + − * / ^, Funktionen wie sum(), round(x, 2), if(bedingung, a, b), years_since({geburtsdatum}).">
        <textarea value={expr} onChange={(e) => upd({ expression: e.target.value }, `f:${field.id}:expr`)} rows={3} spellCheck={false} placeholder="{preis} * {anzahl}" aria-label="Formel" aria-invalid={!!error} data-native-undo className={cn(insInput, "h-auto py-1.5 font-mono text-[12.5px] leading-relaxed")} />
      </Row>
      {sample !== null && !error && (
        <div className="rounded-md bg-paper-2 px-2.5 py-2 text-[12.5px]">
          <span className="text-muted">Probe (jede Zahl = 10): </span>
          <span className="font-mono font-medium">{sample}</span>
        </div>
      )}
      <Row label="Felder einsetzen">
        <div className="flex flex-wrap gap-1">
          {candidates.length === 0 && <span className="text-[12px] text-faint">Noch keine Felder vorhanden.</span>}
          {candidates.map((c) => (
            <button key={c.id} type="button" onClick={() => insert(c.key)} title={c.label} className="rounded-xs border border-line bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2 hover:border-stamp hover:text-stamp">
              {`{${c.key}}`}
            </button>
          ))}
        </div>
      </Row>
      <NumIn label="Nachkommastellen in der Anzeige" value={field.decimals ?? 2} min={0} max={6} step={1} onChange={(n) => upd({ decimals: n })} />
    </Section>
  );
}

function DefaultValue({ field, upd }: { field: Field; upd: (p: Partial<Field>, k?: string) => void }) {
  const set = (val: unknown) => upd({ defaultValue: val === "" || val === undefined ? undefined : val }, `f:${field.id}:default`);
  const dv = field.defaultValue;
  switch (field.type) {
    case "short_text":
    case "long_text":
    case "email":
    case "phone":
    case "hidden":
      return <TextIn label="Standardwert" value={typeof dv === "string" ? dv : ""} onChange={set} />;
    case "number":
    case "currency":
    case "slider":
      return <NumIn label="Standardwert" value={typeof dv === "number" ? dv : undefined} onChange={set} />;
    case "date":
      return (
        <Row label="Standardwert">
          <input type="date" value={typeof dv === "string" ? dv : ""} onChange={(e) => set(e.target.value)} className={insInput} aria-label="Standarddatum" />
        </Row>
      );
    case "dropdown":
    case "single_choice":
      return <NativeSelect label="Vorauswahl" value={typeof dv === "string" ? dv : ""} onChange={set} options={[{ value: "", label: "Keine" }, ...(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))]} />;
    case "yes_no":
      return <NativeSelect<"true" | "false" | ""> label="Vorauswahl" value={dv === true ? "true" : dv === false ? "false" : ""} onChange={(x) => set(x === "" ? undefined : x === "true")} options={[{ value: "", label: "Keine" }, { value: "true", label: "Ja" }, { value: "false", label: "Nein" }]} />;
    case "multi_select":
    case "checkboxes": {
      const arr = Array.isArray(dv) ? (dv as string[]) : [];
      return (
        <Row label="Vorauswahl">
          <div className="space-y-1">
            {(field.options ?? []).map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-[12.5px]">
                <Checkbox checked={arr.includes(o.value)} onCheckedChange={(b) => set(b ? [...arr, o.value] : arr.filter((x) => x !== o.value).length ? arr.filter((x) => x !== o.value) : undefined)} label={o.label} />
                {o.label}
              </label>
            ))}
          </div>
        </Row>
      );
    }
    default:
      return null;
  }
}

function KeyEditor({ field, def }: { field: Field; def: FormDefinition }) {
  const { api, status } = useBuilder();
  const [text, setText] = useState(field.key);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(field.key);
  }, [field.key]);
  const taken = allKeys(def);
  taken.delete(field.key);
  const error = !/^[a-z][a-z0-9_]*$/.test(text) ? "Kleinbuchstaben, Ziffern und _ – beginnend mit einem Buchstaben." : taken.has(text) ? "Dieser Schlüssel ist bereits vergeben." : null;
  const commit = () => {
    if (error || text === field.key) return setText(field.key);
    const old = field.key;
    api.mutate((d) => {
      const l = locate(d, field.id);
      if (l) l.field.key = text;
      // Formeln und Platzhalter mitziehen
      const re = new RegExp(`\\{\\s*${old}\\s*\\}`, "g");
      const re2 = new RegExp(`\\{\\{\\s*${old}\\s*\\}\\}`, "g");
      for (const p of d.pages) for (const f of [...p.fields, ...p.fields.flatMap((x) => x.fields ?? [])]) {
        if (f.expression) f.expression = f.expression.replace(re, `{${text}}`);
        f.label = f.label.replace(re2, `{{${text}}}`);
      }
      for (const e of d.endings) e.body = e.body.replace(re2, `{{${text}}}`);
    });
  };
  return (
    <Section title="Technischer Schlüssel" defaultOpen={false}>
      <Row label="Schlüssel" error={error} hint={status !== "draft" ? "Wird in Exporten, Platzhaltern und der API verwendet. Formeln und Platzhalter in diesem Formular werden angepasst." : "Für Exporte, Platzhalter {{…}} und die API."}>
        <input value={text} onChange={(e) => setText(e.target.value.toLowerCase())} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} aria-invalid={!!error} aria-label="Technischer Schlüssel" className={cn(insInput, "font-mono text-[12.5px]")} />
      </Row>
      <button type="button" onClick={() => setText(slugKey(field.label, taken, field.type))} className="text-[12px] text-stamp hover:underline">Aus der Frage ableiten</button>
    </Section>
  );
}

function ImageSettings({ field, upd }: { field: Field; upd: (p: Partial<Field>, k?: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? "Hochladen fehlgeschlagen.");
      upd({ imageUrl: data.url, imageAlt: field.imageAlt ?? "" });
      toast("Bild hochgeladen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hochladen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Row label="Bild" hint="PNG, JPG, WebP oder GIF bis 5 MB.">
        <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-[13px] text-ink-2 hover:border-stamp hover:text-stamp">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {field.imageUrl ? "Anderes Bild wählen" : "Bild hochladen"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </Row>
      {field.imageUrl && <TextIn label="Alternativtext" value={field.imageAlt} onChange={(t) => upd({ imageAlt: t }, `f:${field.id}:alt`)} hint="Beschreibt das Bild für Screenreader. Leer lassen, wenn es nur Dekoration ist." />}
    </>
  );
}
