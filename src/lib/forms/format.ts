/**
 * Antworten lesbar machen – einheitlich für Detailansicht, Export,
 * PDF, E-Mail und Platzhalter.
 */
import { fieldIndex, isInputField, type Field, type FormDefinition } from "./schema";
import type { Answers } from "./logic";

const NAME_ORDER = ["title", "first", "middle", "last", "suffix"] as const;

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}${m[4] ? `, ${m[4]} Uhr` : ""}`;
}

function optionLabel(field: Field, value: string): string {
  if (value.startsWith("other:")) return `Sonstiges: ${value.slice(6)}`;
  return field.options?.find((o) => o.value === value)?.label ?? value;
}

export function formatNumber(n: number, decimals?: number): string {
  return new Intl.NumberFormat("de-DE", decimals !== undefined ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : { maximumFractionDigits: 6 }).format(n);
}

export function formatValue(field: Field, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  switch (field.type) {
    case "currency":
      return typeof value === "number"
        ? new Intl.NumberFormat("de-DE", { style: "currency", currency: field.currency ?? "EUR" }).format(value)
        : String(value);
    case "number":
    case "slider":
      return typeof value === "number" ? formatNumber(value, field.decimals) : String(value);
    case "calculated":
      return typeof value === "number" ? formatNumber(value, field.decimals ?? 2) : String(value);
    case "rating":
      return `${value} / ${field.ratingMax ?? 5}`;
    case "date":
    case "datetime":
      return formatDate(String(value));
    case "time":
      return `${value} Uhr`;
    case "date_range": {
      const o = value as { start?: string; end?: string };
      return `${formatDate(o.start ?? "")} – ${formatDate(o.end ?? "")}`;
    }
    case "yes_no":
      return value === true ? "Ja" : value === false ? "Nein" : String(value);
    case "consent":
      return value === true ? "Zugestimmt" : "";
    case "dropdown":
    case "single_choice":
      return optionLabel(field, String(value));
    case "multi_select":
    case "checkboxes":
      return Array.isArray(value) ? value.map((v) => optionLabel(field, String(v))).join(", ") : String(value);
    case "name": {
      const o = value as Record<string, string>;
      return NAME_ORDER.map((p) => o[p]).filter(Boolean).join(" ");
    }
    case "address": {
      const o = value as Record<string, string>;
      const line2 = [o.postalCode, o.city].filter(Boolean).join(" ");
      return [o.street, o.line2, line2, o.state, o.country].filter(Boolean).join(", ");
    }
    case "matrix": {
      const o = value as Record<string, string | string[]>;
      const cols = new Map((field.matrix?.columns ?? []).map((c) => [c.value, c.label]));
      return (field.matrix?.rows ?? [])
        .filter((r) => o[r.id])
        .map((r) => {
          const cell = o[r.id];
          const v = Array.isArray(cell) ? cell.map((c) => cols.get(c) ?? c).join(", ") : (cols.get(cell) ?? cell);
          return `${r.label}: ${v}`;
        })
        .join("; ");
    }
    case "file":
      return Array.isArray(value) ? value.map((f) => (f as { name: string }).name).join(", ") : "";
    case "signature":
      return value && typeof value === "object" ? "Unterschrieben" : "";
    case "group": {
      if (!Array.isArray(value)) return "";
      return value
        .map((item, i) => {
          const parts = (field.fields ?? [])
            .filter(isInputField)
            .map((c) => {
              const v = formatValue(c, (item as Answers)[c.id]);
              return v ? `${c.label}: ${v}` : "";
            })
            .filter(Boolean);
          return `${field.itemLabel ?? "Eintrag"} ${i + 1}: ${parts.join(", ")}`;
        })
        .join(" | ");
    }
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

export interface AnswerRow {
  field: Field;
  label: string;
  value: unknown;
  text: string;
}

/** Antworten in Formularreihenfolge (nur Eingabefelder mit Wert). */
export function answerRows(def: FormDefinition, answers: Answers, opts: { includeEmpty?: boolean } = {}): AnswerRow[] {
  const rows: AnswerRow[] = [];
  for (const { field, parent } of fieldIndex(def).values()) {
    if (parent || !isInputField(field)) continue;
    const value = answers[field.id];
    const text = formatValue(field, value);
    if (!text && !opts.includeEmpty) continue;
    rows.push({ field, label: field.label || field.key, value, text });
  }
  return rows;
}
