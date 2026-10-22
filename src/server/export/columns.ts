/**
 * Exportspalten über alle Versionen eines Formulars: Reihenfolge der
 * neuesten Version, danach Felder, die nur in älteren Versionen existieren.
 * Antworten werden mit der Felddefinition ihrer eigenen Version formatiert.
 */
import { formatValue } from "@/lib/forms/format";
import { isInputField, walkFields, type Field, type FormDefinition } from "@/lib/forms/schema";

export interface Column {
  fieldId: string;
  key: string;
  label: string;
  field: Field;
}

export function unionColumns(versions: { definition: FormDefinition }[]): Column[] {
  const cols: Column[] = [];
  const seen = new Set<string>();
  // neueste zuerst, damit Labels und Reihenfolge der aktuellen Fassung gelten
  for (const v of [...versions].reverse()) {
    for (const { field, parent } of walkFields(v.definition)) {
      if (parent || !isInputField(field) || seen.has(field.id)) continue;
      seen.add(field.id);
      cols.push({ fieldId: field.id, key: field.key, label: field.label || field.key, field });
    }
  }
  return cols;
}

/** Feld in der Version der Antwort finden (Fallback: Spaltendefinition). */
export function fieldFor(def: FormDefinition | undefined, col: Column): Field {
  if (def) for (const { field } of walkFields(def)) if (field.id === col.fieldId) return field;
  return col.field;
}

export function cellText(def: FormDefinition | undefined, col: Column, data: Record<string, unknown>): string {
  return formatValue(fieldFor(def, col), data[col.fieldId]);
}
