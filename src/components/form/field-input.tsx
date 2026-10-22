"use client";
/**
 * Eingabekomponenten für alle Feldtypen. Kontrolliert (value/onChange),
 * ohne Kenntnis von Seiten, Logik oder Server – genutzt vom öffentlichen
 * Renderer und von der Vorschau im Editor.
 */
import { Check, FileText, Heart, Loader2, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Field } from "@/lib/forms/schema";
import type { FileRef } from "@/lib/forms/validate";
import { formatValue } from "@/lib/forms/format";
import { isInputField } from "@/lib/forms/schema";
import { SignaturePad } from "./signature-pad";

export interface UploadContext {
  upload: (fieldId: string, file: File, onProgress: (p: number) => void) => Promise<FileRef>;
}

export interface FieldInputProps {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  /** Fehler einzelner Gruppeneinträge: `index.childId` → Meldung */
  childErrors?: Record<string, string>;
  label?: string;
  description?: string;
  required?: boolean;
  computed?: unknown;
  uploads?: UploadContext;
  /** Kartenmodus: größere Typografie, Auswahl mit Tastenkürzeln */
  large?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
}

export const inputCls =
  "w-full rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)] px-3 text-[15px] text-[var(--f-ink)] placeholder:text-[var(--f-faint)] transition-[border,box-shadow] duration-150 hover:border-[var(--f-line-strong)] focus:border-[var(--f-accent)] focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--f-accent)_18%,transparent)] aria-[invalid=true]:border-[var(--f-bad)] disabled:opacity-60";

export function FieldShell({ field, id, label, description, required, error, children, large, as = "div" }: { field: Field; id: string; label: string; description?: string; required?: boolean; error?: string; children: ReactNode; large?: boolean; as?: "div" | "fieldset" }) {
  const Tag = as;
  const LabelTag = as === "fieldset" ? "legend" : "label";
  return (
    <Tag className="min-w-0 space-y-2" data-field={field.id}>
      {label && (
        <LabelTag {...(as === "div" ? { htmlFor: id } : {})} id={`${id}-label`} className={cn("block font-medium text-[var(--f-ink)]", large ? "font-[family-name:var(--f-display)] text-[clamp(22px,4vw,30px)] leading-tight font-[450] tracking-[-0.01em]" : "text-[15px]")}>
          {label}
          {required && <span className="ml-1 text-[var(--f-accent)]" aria-hidden>*</span>}
          {required && <span className="sr-only"> (Pflichtfeld)</span>}
        </LabelTag>
      )}
      {description && <p id={`${id}-desc`} className={cn("whitespace-pre-line text-[var(--f-muted)]", large ? "text-[16px]" : "text-[13.5px] leading-relaxed")}>{description}</p>}
      <div className={cn(large && "pt-2")}>{children}</div>
      {error && (
        <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-[13.5px] text-[var(--f-bad)] animate-fade-in">
          {error}
        </p>
      )}
    </Tag>
  );
}

function describedBy(id: string, description?: string, error?: string) {
  return [description && `${id}-desc`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
}

export function FieldInput(props: FieldInputProps) {
  const { field, value, onChange, error, large, disabled, autoFocus, onEnter } = props;
  const id = `q-${field.id}`;
  const label = props.label ?? field.label;
  const description = props.description ?? field.description;
  const required = props.required ?? field.required;
  const aria = { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy(id, description, error), "aria-required": required || undefined };
  const h = large ? "h-12 text-[17px]" : "h-11";
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnter && !(e.nativeEvent as KeyboardEvent).isComposing) {
      e.preventDefault();
      onEnter();
    }
  };
  const shell = (children: ReactNode, as: "div" | "fieldset" = "div") => (
    <FieldShell field={field} id={id} label={label} description={description} required={required} error={error} large={large} as={as}>
      {children}
    </FieldShell>
  );
  const str = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);

  switch (field.type) {
    case "heading": {
      const Tag = field.level === 1 ? "h2" : field.level === 3 ? "h4" : "h3";
      return (
        <div className="pt-2">
          <Tag className={cn("font-[family-name:var(--f-display)] font-[450] tracking-[-0.01em] text-[var(--f-ink)]", field.level === 1 ? "text-[28px]" : field.level === 3 ? "text-[18px]" : "text-[22px]")}>{label}</Tag>
          {description && <p className="mt-1 whitespace-pre-line text-[14.5px] text-[var(--f-muted)]">{description}</p>}
        </div>
      );
    }
    case "paragraph":
      return <div className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--f-ink-2)]">{description || label}</div>;
    case "divider":
      return <hr className="border-[var(--f-line)]" />;
    case "image":
      return field.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={field.imageUrl} alt={field.imageAlt ?? ""} className="max-h-96 w-auto max-w-full rounded-[var(--f-radius)]" />
      ) : null;
    case "hidden":
      return null;
    case "calculated":
      return shell(
        <output id={id} className={cn("block font-mono tabular-nums text-[var(--f-ink)]", large ? "text-[28px]" : "text-[18px]")} aria-live="polite">
          {props.computed === null || props.computed === undefined || props.computed === "" ? "–" : formatValue(field, props.computed)}
        </output>,
      );
    case "short_text":
    case "email":
    case "phone":
      return shell(
        <input
          id={id}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          inputMode={field.type === "email" ? "email" : field.type === "phone" ? "tel" : undefined}
          autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "off"}
          className={cn(inputCls, h)}
          value={str}
          placeholder={field.placeholder}
          maxLength={field.validation?.maxLength}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={enter}
          disabled={disabled}
          autoFocus={autoFocus}
          {...aria}
        />,
      );
    case "long_text":
      return shell(
        <>
          <textarea
            id={id}
            className={cn(inputCls, "min-h-28 resize-y py-2.5 leading-relaxed", large && "text-[17px]")}
            value={str}
            placeholder={field.placeholder}
            maxLength={field.validation?.maxLength}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            autoFocus={autoFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onEnter) onEnter();
            }}
            {...aria}
          />
          {field.validation?.maxLength && (
            <div className="mt-1 text-right font-mono text-[11.5px] text-[var(--f-faint)] tabular-nums">
              {str.length} / {field.validation.maxLength}
            </div>
          )}
        </>,
      );
    case "number":
    case "currency":
      return shell(
        <div className="relative">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            className={cn(inputCls, h, "tabular-nums", field.type === "currency" && "pr-14")}
            value={str}
            placeholder={field.placeholder ?? (field.type === "currency" ? "0,00" : undefined)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={enter}
            disabled={disabled}
            autoFocus={autoFocus}
            {...aria}
          />
          {field.type === "currency" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--f-muted)]">{field.currency === "EUR" ? "€" : field.currency}</span>}
        </div>,
      );
    case "date":
    case "time":
    case "datetime":
      return shell(
        <input
          id={id}
          type={field.type === "datetime" ? "datetime-local" : field.type}
          className={cn(inputCls, h, "max-w-64")}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={enter}
          disabled={disabled}
          autoFocus={autoFocus}
          {...aria}
        />,
      );
    case "date_range": {
      const v = (value ?? {}) as { start?: string; end?: string };
      return shell(
        <div className="flex flex-wrap items-center gap-2">
          <input id={id} type="date" aria-label="Von" className={cn(inputCls, h, "w-auto")} value={v.start ?? ""} onChange={(e) => onChange({ ...v, start: e.target.value })} disabled={disabled} {...aria} />
          <span className="text-[var(--f-muted)]">bis</span>
          <input type="date" aria-label="Bis" className={cn(inputCls, h, "w-auto")} value={v.end ?? ""} min={v.start} onChange={(e) => onChange({ ...v, end: e.target.value })} disabled={disabled} />
        </div>,
      );
    }
    case "dropdown":
      return shell(
        <select id={id} className={cn(inputCls, h, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23777%22 stroke-width=%222%22><path d=%22M4 6l4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10")} value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} autoFocus={autoFocus} {...aria}>
          <option value="">{field.placeholder ?? "Bitte wählen …"}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.id} value={o.value}>{o.label}</option>
          ))}
        </select>,
      );
    case "single_choice":
    case "yes_no": {
      const opts = field.type === "yes_no" ? [{ id: "yes", label: "Ja", value: "true" }, { id: "no", label: "Nein", value: "false" }] : (field.options ?? []);
      const current = field.type === "yes_no" ? (value === true ? "true" : value === false ? "false" : "") : str;
      const set = (v: string) => onChange(field.type === "yes_no" ? v === "true" : v);
      return shell(
        <ChoiceList field={field} id={id} options={opts} selected={current ? [current] : []} onToggle={set} multiple={false} large={large} disabled={disabled} aria={aria} onEnter={onEnter} horizontal={field.type === "yes_no"} />,
        "fieldset",
      );
    }
    case "checkboxes":
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return shell(
        <ChoiceList field={field} id={id} options={field.options ?? []} selected={arr} onToggle={(v) => onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])} multiple large={large} disabled={disabled} aria={aria} chips={field.type === "multi_select"} />,
        "fieldset",
      );
    }
    case "consent":
      return (
        <div data-field={field.id} className="space-y-2">
          {label && label !== "Einwilligung" && <div className="text-[15px] font-medium">{label}</div>}
          <label className={cn("flex cursor-pointer items-start gap-3 rounded-[var(--f-radius)] border p-3.5 transition-colors", value === true ? "border-[var(--f-accent)] bg-[var(--f-accent-soft)]" : "border-[var(--f-line)] bg-[var(--f-field)] hover:border-[var(--f-line-strong)]")}>
            <input type="checkbox" id={id} className="peer sr-only" checked={value === true} onChange={(e) => onChange(e.target.checked)} disabled={disabled} {...aria} />
            <Box checked={value === true} />
            <span className="text-[14.5px] leading-relaxed whitespace-pre-line text-[var(--f-ink-2)]">
              {field.consentText || label}
              {required && <span className="ml-1 text-[var(--f-accent)]" aria-hidden>*</span>}
            </span>
          </label>
          {error && <p id={`${id}-err`} role="alert" className="text-[13.5px] text-[var(--f-bad)]">{error}</p>}
        </div>
      );
    case "name": {
      const v = (value ?? {}) as Record<string, string>;
      const parts = field.nameParts ?? ["first", "last"];
      const LABELS: Record<string, [string, string]> = { title: ["Anrede/Titel", "honorific-prefix"], first: ["Vorname", "given-name"], middle: ["Zweiter Vorname", "additional-name"], last: ["Nachname", "family-name"], suffix: ["Zusatz", "honorific-suffix"] };
      return shell(
        <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2">
          {parts.map((p, i) => (
            <input key={p} id={i === 0 ? id : undefined} aria-label={LABELS[p][0]} placeholder={LABELS[p][0]} autoComplete={LABELS[p][1]} className={cn(inputCls, h, p === "title" && "@lg:col-span-2 @lg:max-w-48")} value={v[p] ?? ""} onChange={(e) => onChange({ ...v, [p]: e.target.value })} disabled={disabled} autoFocus={autoFocus && i === 0} onKeyDown={enter} {...(i === 0 ? aria : {})} />
          ))}
        </div>,
        "fieldset",
      );
    }
    case "address": {
      const v = (value ?? (field.defaultCountry ? { country: field.defaultCountry } : {})) as Record<string, string>;
      const parts = field.addressParts ?? ["street", "postalCode", "city", "country"];
      const P: Record<string, [string, string, string]> = {
        street: ["Straße und Hausnummer", "address-line1", "@lg:col-span-6"],
        line2: ["Adresszusatz", "address-line2", "@lg:col-span-6"],
        postalCode: ["PLZ", "postal-code", "@lg:col-span-2"],
        city: ["Ort", "address-level2", "@lg:col-span-4"],
        state: ["Bundesland", "address-level1", "@lg:col-span-3"],
        country: ["Land", "country-name", "@lg:col-span-3"],
      };
      return shell(
        <div className="grid grid-cols-1 gap-2 @lg:grid-cols-6">
          {parts.map((p, i) => (
            <input key={p} id={i === 0 ? id : undefined} aria-label={P[p][0]} placeholder={P[p][0]} autoComplete={P[p][1]} inputMode={p === "postalCode" ? "numeric" : undefined} className={cn(inputCls, h, P[p][2])} value={v[p] ?? ""} onChange={(e) => onChange({ ...v, [p]: e.target.value })} disabled={disabled} autoFocus={autoFocus && i === 0} {...(i === 0 ? aria : {})} />
          ))}
        </div>,
        "fieldset",
      );
    }
    case "rating": {
      const max = field.ratingMax ?? 5;
      const n = typeof value === "number" ? value : Number(value) || 0;
      return shell(<Rating id={id} max={max} value={n} icon={field.ratingIcon ?? "star"} onChange={onChange} disabled={disabled} large={large} aria={aria} />, "fieldset");
    }
    case "slider": {
      const min = field.validation?.min ?? 0;
      const max = field.validation?.max ?? 100;
      const step = field.validation?.step ?? 1;
      const n = value === undefined || value === "" || value === null ? null : Number(value);
      return shell(
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <input id={id} type="range" min={min} max={max} step={step} value={n ?? min} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className="h-2 flex-1 cursor-pointer accent-[var(--f-accent)]" {...aria} aria-valuetext={n === null ? "keine Angabe" : String(n)} />
            <output className={cn("min-w-12 text-right font-mono tabular-nums", n === null ? "text-[var(--f-faint)]" : "text-[var(--f-ink)]", large ? "text-[22px]" : "text-[16px]")}>{n ?? "–"}</output>
          </div>
          {field.sliderLabels && (
            <div className="flex justify-between text-[12.5px] text-[var(--f-muted)]">
              <span>{field.sliderLabels[0]}</span>
              <span>{field.sliderLabels[1]}</span>
            </div>
          )}
        </div>,
      );
    }
    case "matrix": {
      const mx = field.matrix;
      if (!mx) return null;
      const v = (value ?? {}) as Record<string, string | string[]>;
      const pick = (rowId: string, col: string, checked: boolean) => {
        if (mx.multiple) {
          const arr = Array.isArray(v[rowId]) ? (v[rowId] as string[]) : [];
          onChange({ ...v, [rowId]: checked ? arr.filter((x) => x !== col) : [...arr, col] });
        } else onChange({ ...v, [rowId]: col });
      };
      return shell(
        <div className="@container">
        {/* Schmal (Smartphone, schmale Einbettung): jede Zeile als eigene, benannte Auswahl */}
        <div className="space-y-3 @min-[29rem]:hidden">
          {mx.rows.map((r) => {
            const cell = v[r.id];
            return (
              <div key={r.id} role={mx.multiple ? "group" : "radiogroup"} aria-label={r.label} className="rounded-[var(--f-radius)] bg-[var(--f-tint)] p-3">
                <div className="mb-2 text-[14px] font-medium text-[var(--f-ink-2)]">{r.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {mx.columns.map((c) => {
                    const checked = Array.isArray(cell) ? cell.includes(c.value) : cell === c.value;
                    return (
                      <button key={c.id} type="button" role={mx.multiple ? "checkbox" : "radio"} aria-checked={checked} disabled={disabled} onClick={() => pick(r.id, c.value, checked)} className={cn("min-h-10 rounded-[var(--f-radius)] border px-3 text-[14px] transition-colors", checked ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-ink)]" : "border-[var(--f-line)] bg-[var(--f-field)] text-[var(--f-ink-2)]")}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="-mx-1 hidden overflow-x-auto px-1 @min-[29rem]:block">
          <table className="w-full border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th className="w-[38%]" />
                {mx.columns.map((c) => (
                  <th key={c.id} scope="col" className="px-2 pb-2 text-center text-[12.5px] font-medium text-[var(--f-muted)]">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mx.rows.map((r, ri) => (
                <tr key={r.id} className={ri % 2 ? "" : "bg-[var(--f-tint)]"}>
                  <th scope="row" className="rounded-l-[var(--f-radius)] px-3 py-2.5 text-left font-normal text-[var(--f-ink-2)]">{r.label}</th>
                  {mx.columns.map((c, ci) => {
                    const cell = v[r.id];
                    const checked = Array.isArray(cell) ? cell.includes(c.value) : cell === c.value;
                    return (
                      <td key={c.id} className={cn("px-2 py-2.5 text-center", ci === mx.columns.length - 1 && "rounded-r-[var(--f-radius)]")}>
                        <input
                          type={mx.multiple ? "checkbox" : "radio"}
                          name={`${id}-${r.id}`}
                          aria-label={`${r.label}: ${c.label}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => {
                            if (mx.multiple) {
                              const arr = Array.isArray(cell) ? cell : [];
                              onChange({ ...v, [r.id]: checked ? arr.filter((x) => x !== c.value) : [...arr, c.value] });
                            } else onChange({ ...v, [r.id]: c.value });
                          }}
                          className="size-[18px] cursor-pointer accent-[var(--f-accent)]"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>,
        "fieldset",
      );
    }
    case "file":
      return shell(<FileInput field={field} id={id} value={Array.isArray(value) ? (value as FileRef[]) : []} onChange={onChange} uploads={props.uploads} disabled={disabled} aria={aria} />);
    case "signature":
      return shell(<SignaturePad id={id} value={value as { dataUrl?: string } | undefined} onChange={onChange} disabled={disabled} invalid={!!error} />);
    case "group":
      return <RepeatGroup {...props} label={label} description={description} required={required} />;
  }
}

function Box({ checked, round }: { checked: boolean; round?: boolean }) {
  return (
    <span aria-hidden className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center border transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-[color-mix(in_srgb,var(--f-accent)_30%,transparent)]", round ? "rounded-full" : "rounded-[4px]", checked ? "border-[var(--f-accent)] bg-[var(--f-accent)]" : "border-[var(--f-line-strong)] bg-[var(--f-field)]")}>
      {checked && (round ? <span className="size-1.5 rounded-full bg-[var(--f-accent-ink)]" /> : <Check className="size-3 text-[var(--f-accent-ink)]" strokeWidth={3.5} />)}
    </span>
  );
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function ChoiceList({ field, id, options, selected, onToggle, multiple, large, disabled, aria, chips, horizontal, onEnter }: {
  field: Field;
  id: string;
  options: { id: string; label: string; value: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  multiple: boolean;
  large?: boolean;
  disabled?: boolean;
  aria: Record<string, unknown>;
  chips?: boolean;
  horizontal?: boolean;
  onEnter?: () => void;
}) {
  const [other, setOther] = useState(() => selected.find((s) => s.startsWith("other:"))?.slice(6) ?? "");
  const otherSelected = selected.some((s) => s.startsWith("other:"));
  const all = field.allowOther ? [...options, { id: "__other", label: "Sonstiges", value: `other:${other}` }] : options;

  // Kartenmodus: Buchstaben-Tasten wählen Optionen
  useEffect(() => {
    if (!large || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "text") return;
      if (t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = LETTERS.indexOf(e.key.toUpperCase());
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        onToggle(options[i].value);
        if (!multiple && onEnter) setTimeout(onEnter, 280);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [large, disabled, options, onToggle, multiple, onEnter]);

  if (chips && !large) {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`} {...aria}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button key={o.id} type="button" aria-pressed={on} disabled={disabled} onClick={() => onToggle(o.value)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] transition-colors", on ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-ink)]" : "border-[var(--f-line)] bg-[var(--f-field)] text-[var(--f-ink-2)] hover:border-[var(--f-line-strong)]")}>
              {on && <Check className="size-3.5" strokeWidth={3} />}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn(horizontal ? "flex flex-wrap gap-2" : "grid gap-2", !horizontal && options.length > 6 && !large && "@lg:grid-cols-2")} role={multiple ? "group" : "radiogroup"} aria-labelledby={`${id}-label`} {...aria}>
      {all.map((o, i) => {
        const isOther = o.id === "__other";
        const on = isOther ? otherSelected : selected.includes(o.value);
        return (
          <label key={o.id} className={cn("group relative flex cursor-pointer items-center gap-3 rounded-[var(--f-radius)] border px-3.5 transition-[border,background,transform] duration-150 active:scale-[0.995]", large ? "min-h-14 text-[17px]" : "min-h-11 text-[15px]", horizontal && "min-w-28", on ? "border-[var(--f-accent)] bg-[var(--f-accent-soft)]" : "border-[var(--f-line)] bg-[var(--f-field)] hover:border-[var(--f-line-strong)]", disabled && "pointer-events-none opacity-60")}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={id}
              value={o.value}
              checked={on}
              disabled={disabled}
              className="peer sr-only"
              onChange={() => {
                if (isOther) {
                  if (on) onToggle(selected.find((s) => s.startsWith("other:"))!);
                  else onToggle(`other:${other || " "}`);
                } else {
                  onToggle(o.value);
                  // Kartenmodus: Klick auf eine Antwort springt weiter – wie die Buchstabentaste
                  if (large && !multiple && onEnter) setTimeout(onEnter, 280);
                }
              }}
            />
            {large ? (
              <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-[5px] border font-mono text-[12px]", on ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-ink)]" : "border-[var(--f-line-strong)] text-[var(--f-muted)]")}>{isOther ? "…" : LETTERS[i]}</span>
            ) : (
              <Box checked={on} round={!multiple} />
            )}
            {isOther && on ? (
              <input
                type="text"
                autoFocus
                aria-label="Sonstiges, bitte angeben"
                placeholder="Bitte angeben"
                className="h-8 flex-1 bg-transparent text-[inherit] outline-none placeholder:text-[var(--f-faint)]"
                value={other}
                onClick={(e) => e.preventDefault()}
                onChange={(e) => {
                  const prev = selected.find((s) => s.startsWith("other:"))!;
                  setOther(e.target.value);
                  onToggle(prev);
                  onToggle(`other:${e.target.value}`);
                }}
              />
            ) : (
              <span className="py-2 leading-snug text-[var(--f-ink)]">{o.label}</span>
            )}
            {on && !isOther && large && <Check className="ml-auto size-4 text-[var(--f-accent)]" />}
          </label>
        );
      })}
    </div>
  );
}

function Rating({ id, max, value, icon, onChange, disabled, large, aria }: { id: string; max: number; value: number; icon: "star" | "heart" | "number"; onChange: (v: unknown) => void; disabled?: boolean; large?: boolean; aria: Record<string, unknown> }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const Icon = icon === "heart" ? Heart : Star;
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1" onMouseLeave={() => setHover(0)} {...aria}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} von ${max}`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? undefined : n)}
          className={cn("grid place-items-center rounded-[var(--f-radius)] transition-transform hover:scale-110", large ? "size-12" : "size-10", icon === "number" && cn("border font-mono text-[15px]", n <= shown ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-ink)]" : "border-[var(--f-line)] bg-[var(--f-field)]"))}
        >
          {icon === "number" ? n : <Icon className={cn(large ? "size-8" : "size-7", n <= shown ? "fill-[var(--f-accent)] text-[var(--f-accent)]" : "text-[var(--f-line-strong)]")} strokeWidth={1.5} />}
        </button>
      ))}
    </div>
  );
}

function fmtSize(n: number) {
  return n < 1024 ? "<1 KB" : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function FileInput({ field, id, value, onChange, uploads, disabled, aria }: { field: Field; id: string; value: FileRef[]; onChange: (v: unknown) => void; uploads?: UploadContext; disabled?: boolean; aria: Record<string, unknown> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; progress: number }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const max = field.maxFiles ?? 1;
  const maxMb = field.maxFileSizeMb ?? 10;
  const room = max - value.length - busy.length;

  async function add(files: FileList | File[]) {
    setErr(null);
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (Array.from(files).length > room) setErr(max === 1 ? "Es ist nur eine Datei möglich." : `Höchstens ${max} Dateien.`);
    if (!uploads) return setErr("Hochladen ist in der Vorschau nicht möglich.");
    let current = value;
    for (const f of list) {
      if (f.size > maxMb * 1024 * 1024) {
        setErr(`„${f.name}“ ist größer als ${maxMb} MB.`);
        continue;
      }
      setBusy((b) => [...b, { name: f.name, progress: 0 }]);
      try {
        const ref = await uploads.upload(field.id, f, (p) => setBusy((b) => b.map((x) => (x.name === f.name ? { ...x, progress: p } : x))));
        current = [...current, ref];
        onChange(current);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Hochladen fehlgeschlagen.");
      } finally {
        setBusy((b) => b.filter((x) => x.name !== f.name));
      }
    }
  }

  return (
    <div className="space-y-2">
      {room > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!disabled) void add(e.dataTransfer.files);
          }}
          className={cn("flex flex-col items-center justify-center gap-1.5 rounded-[var(--f-radius)] border border-dashed px-4 py-6 text-center transition-colors", drag ? "border-[var(--f-accent)] bg-[var(--f-accent-soft)]" : "border-[var(--f-line-strong)] bg-[var(--f-tint)]")}
        >
          <Upload className="size-5 text-[var(--f-muted)]" />
          <div className="text-[14.5px]">
            <button type="button" id={id} disabled={disabled} onClick={() => input.current?.click()} className="font-medium text-[var(--f-accent)] underline-offset-2 hover:underline" {...aria}>
              Datei auswählen
            </button>{" "}
            <span className="text-[var(--f-muted)]">oder hierher ziehen</span>
          </div>
          <div className="text-[12.5px] text-[var(--f-faint)]">
            {acceptLabel(field.accept)} · bis {maxMb} MB{max > 1 ? ` · bis zu ${max} Dateien` : ""}
          </div>
          <input ref={input} type="file" className="sr-only" tabIndex={-1} multiple={max > 1} accept={field.accept?.join(",")} onChange={(e) => e.target.files && add(e.target.files).then(() => (e.target.value = ""))} />
        </div>
      )}
      {(value.length > 0 || busy.length > 0) && (
        <ul className="space-y-1.5">
          {value.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)] px-3 py-2 text-[14px] animate-pop-in">
              <FileText className="size-4 shrink-0 text-[var(--f-muted)]" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="font-mono text-[12px] text-[var(--f-faint)]">{fmtSize(f.size)}</span>
              <button type="button" aria-label={`${f.name} entfernen`} disabled={disabled} onClick={() => onChange(value.filter((x) => x.id !== f.id))} className="rounded p-1 text-[var(--f-muted)] hover:bg-[var(--f-tint)] hover:text-[var(--f-ink)]">
                <X className="size-4" />
              </button>
            </li>
          ))}
          {busy.map((b) => (
            <li key={b.name} className="flex items-center gap-3 rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)] px-3 py-2 text-[14px]">
              <Loader2 className="size-4 shrink-0 animate-spin text-[var(--f-accent)]" />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <span className="h-1 w-20 overflow-hidden rounded-full bg-[var(--f-tint)]">
                <span className="block h-full bg-[var(--f-accent)] transition-[width]" style={{ width: `${Math.round(b.progress * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" className="text-[13.5px] text-[var(--f-bad)]">{err}</p>}
    </div>
  );
}

const ACCEPT_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/heic": "HEIC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.oasis.opendocument.text": "ODT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "text/plain": "TXT",
};
function acceptLabel(accept?: string[]) {
  if (!accept?.length) return "Alle gängigen Formate";
  return accept.map((a) => ACCEPT_NAMES[a] ?? a.split("/").pop()?.toUpperCase()).join(", ");
}

function RepeatGroup(props: FieldInputProps & { label: string; description?: string; required?: boolean }) {
  const { field, value, onChange, error, childErrors, disabled } = props;
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const min = field.minItems ?? 0;
  const max = field.maxItems ?? 10;
  const uid = useId();
  // Mindestanzahl sofort anzeigen
  useEffect(() => {
    if (items.length < Math.max(min, 1) && !disabled) onChange([...items, ...Array.from({ length: Math.max(min, 1) - items.length }, () => ({}))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const children = (field.fields ?? []).filter((c) => c.type !== "group" && c.type !== "file" && c.type !== "signature");
  return (
    <fieldset className="min-w-0 space-y-3" data-field={field.id} aria-describedby={error ? `${uid}-err` : undefined}>
      <legend className="text-[15px] font-medium">
        {props.label}
        {props.required && <span className="ml-1 text-[var(--f-accent)]" aria-hidden>*</span>}
      </legend>
      {props.description && <p className="text-[13.5px] text-[var(--f-muted)]">{props.description}</p>}
      {items.map((item, i) => (
        <div key={i} className="relative rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-tint)] p-4 animate-pop-in">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold tracking-wide text-[var(--f-muted)] uppercase">
              {field.itemLabel ?? "Eintrag"} {i + 1}
            </span>
            {items.length > min && (
              <button type="button" disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`${field.itemLabel ?? "Eintrag"} ${i + 1} entfernen`} className="rounded p-1 text-[var(--f-muted)] hover:bg-[var(--f-field)] hover:text-[var(--f-bad)]">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
            {children.map((c) => (
              <div key={c.id} className={cn("min-w-0", c.width !== "half" && "@lg:col-span-2")}>
                <FieldInput field={{ ...c, id: `${field.id}-${i}-${c.id}` }} value={item[c.id]} onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, [c.id]: v } : it)))} error={childErrors?.[`${i}.${c.id}`]} disabled={disabled} required={c.required} />
              </div>
            ))}
            {children.filter(isInputField).length === 0 && <p className="text-[13px] text-[var(--f-faint)]">Diese Gruppe enthält noch keine Felder.</p>}
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" disabled={disabled} onClick={() => onChange([...items, {}])} className="inline-flex h-10 items-center gap-2 rounded-[var(--f-radius)] border border-dashed border-[var(--f-line-strong)] px-4 text-[14px] font-medium text-[var(--f-ink-2)] hover:border-[var(--f-accent)] hover:text-[var(--f-accent)]">
          <Plus className="size-4" />
          {field.itemLabel ?? "Eintrag"} hinzufügen
        </button>
      )}
      {error && <p id={`${uid}-err`} role="alert" className="text-[13.5px] text-[var(--f-bad)]">{error}</p>}
    </fieldset>
  );
}
