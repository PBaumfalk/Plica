/**
 * Kleiner Baukasten für Vorlagen: erzeugt Felder mit eindeutigen
 * Schlüsseln und frischen IDs. Vorlagen sind Funktionen – jeder Aufruf
 * liefert eine neue, unabhängige Definition.
 */
import { createField, emptyDefinition, newId, options } from "@/lib/forms/fields";
import type { Action, Condition, Ending, Field, FieldType, FormDefinition, Page, Rule } from "@/lib/forms/schema";

const STANDARD_KEYS: Partial<Record<FieldType, string>> = { name: "name", email: "email", phone: "telefon", address: "anschrift" };

export class Kit {
  private taken = new Set<string>();

  field(type: FieldType, label: string, extra: Partial<Field> = {}): Field {
    // Einheitliche Schlüssel für Stammdaten – so passen Folgeformulare zusammen.
    const std = STANDARD_KEYS[type];
    if (!extra.key && std && !this.taken.has(std)) extra = { ...extra, key: std };
    const f = createField(type, this.taken, { label, ...extra });
    this.taken.add(f.key);
    return f;
  }

  choice(type: "dropdown" | "single_choice" | "checkboxes" | "multi_select", label: string, labels: string[], extra: Partial<Field> = {}): Field {
    return this.field(type, label, { options: options(...labels), ...extra });
  }

  /** Auswahl mit festen, sprechenden Werten (für Regeln). */
  choiceValues(type: "dropdown" | "single_choice", label: string, pairs: [value: string, label: string][], extra: Partial<Field> = {}): Field {
    return this.field(type, label, { options: pairs.map(([value, l]) => ({ id: newId("o_"), label: l, value })), ...extra });
  }

  page(title: string, fields: Field[], description?: string): Page {
    return { id: newId("p_"), title, description, fields };
  }

  rule(conditions: Condition[], actions: Action[], name?: string, match: "all" | "any" = "all"): Rule {
    return { id: newId("r_"), name, enabled: true, match, conditions, actions };
  }

  ending(title: string, body: string, redirectUrl?: string): Ending {
    return { id: newId("e_"), title, body, redirectUrl };
  }
}

export function build(
  title: string,
  pages: Page[],
  opts: { description?: string; rules?: Rule[]; endings?: Ending[]; settings?: Partial<FormDefinition["settings"]> } = {},
): FormDefinition {
  const base = emptyDefinition(title);
  return {
    ...base,
    description: opts.description,
    pages,
    rules: opts.rules ?? [],
    endings: opts.endings?.length ? opts.endings : base.endings,
    settings: { ...base.settings, ...opts.settings, theme: { ...base.settings.theme, ...opts.settings?.theme } },
  };
}

export const PRIVACY = "Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage gespeichert und verarbeitet werden. Die Einwilligung kann ich jederzeit mit Wirkung für die Zukunft widerrufen.";
