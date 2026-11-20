/**
 * Formular aus einer Beschreibung erzeugen – ohne KI, deterministisch.
 * „Anmeldung für Sommerfest mit Name, E-Mail, Anzahl Personen,
 *  vegetarisch ja/nein, Essen (Fleisch, Fisch, Vegan), Datenschutz“
 * Erkennt deutsche und englische Begriffe. Das Ergebnis ist ein normaler,
 * vollständig editierbarer Entwurf.
 */
import { createField, emptyDefinition, newId } from "./fields";
import type { Field, FieldType, FormDefinition } from "./schema";

export interface SimpleField {
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
  description?: string;
}

export interface SimpleForm {
  title: string;
  description?: string;
  mode?: "classic" | "cards" | "wizard";
  fields: SimpleField[];
}

type Rule = { re: RegExp; type: FieldType; label?: string; extra?: Partial<SimpleField> };

// Reihenfolge zählt: spezifische Begriffe vor allgemeinen.
const RULES: Rule[] = [
  { re: /\b(datenschutz|dsgvo|einwilligung|privacy|gdpr|consent)/i, type: "consent", label: "Datenschutz" },
  { re: /\b(unterschrift|unterschreiben|signatur|signature|sign)\b/i, type: "signature", label: "Unterschrift" },
  { re: /\b(e-?mail|mail-?adresse|email address)/i, type: "email", label: "E-Mail" },
  { re: /\b(telefon|handy|mobil|rufnummer|phone|mobile)/i, type: "phone", label: "Telefon" },
  { re: /\b(adresse|anschrift|wohnort|address)\b/i, type: "address", label: "Adresse" },
  { re: /\b(geburtsdatum|geburtstag|date of birth|birthday)/i, type: "date", label: "Geburtsdatum" },
  { re: /\b(zeitraum|von bis|date range|urlaub)\b/i, type: "date_range" },
  // Zusammengesetzte Wörter („Kündigungsdatum“, „Unfalltag“) ohne Wortgrenze erkennen
  { re: /(datum|termin|stichtag|unfalltag|tag des|zeitpunkt|\btag\b|\bdate\b|\bwann\b)/i, type: "date" },
  { re: /\b(uhrzeit|zeit|time)\b/i, type: "time" },
  { re: /\b(lebenslauf|datei|upload|hochladen|anhang|anhänge|dokument|dokumente|unterlagen|foto|bild|file|attachment|resume|cv)\b/i, type: "file" },
  { re: /\b(bewertung|sterne|zufriedenheit|rating|stars)\b/i, type: "rating" },
  { re: /\b(betrag|preis|budget|kosten|gehalt|euro|amount|price|salary)\b|€/i, type: "currency" },
  { re: /\b(anzahl|menge|wie viele|personen|alter|quantity|number of|count|age)\b/i, type: "number" },
  { re: /\b(nachricht|anliegen|sachverhalt|beschreiben|schildern|kommentar|bemerkung|beschreibung|hinweis|anmerkung|frage|feedback|message|comment|notes|description)\b/i, type: "long_text" },
  { re: /^(vorname|nachname|name|vor- und nachname|full name|your name)$/i, type: "name", label: "Name" },
  { re: /\b(vor- und nachname|ihr name|dein name|full name|your name)\b/i, type: "name", label: "Name" },
];

const YES_NO = /\b(ja\s*\/\s*nein|ja oder nein|yes\s*\/\s*no|yes or no)\b|\?$/i;
const STOP = /^(und|sowie|plus|and|mit|with)\s+/i;

/** Komma-Liste splitten, aber nicht innerhalb von Klammern. */
function splitItems(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "," || ch === ";" || ch === "\n" || ch === "•")) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out
    .flatMap((x) => x.split(/\s+(?:und|sowie|and)\s+(?![^()]*\))/i))
    .map((x) => x.replace(/^[\s\-–*\d.)]+/, "").replace(STOP, "").trim())
    .filter((x) => x.length > 1);
}

function cap(s: string): string {
  return s.charAt(0).toLocaleUpperCase("de") + s.slice(1);
}

function itemToField(raw: string): SimpleField {
  let label = raw.trim().replace(/\s+/g, " ");
  let required: boolean | undefined;
  if (/\b(optional|freiwillig)\b/i.test(label)) {
    required = false;
    label = label.replace(/\s*\(?\b(optional|freiwillig)\b\)?/i, "").trim();
  } else if (/\b(pflicht|erforderlich|required)\b|\*$/i.test(label)) {
    required = true;
    label = label.replace(/\s*\(?\b(pflicht(feld)?|erforderlich|required)\b\)?|\*$/i, "").trim();
  }

  // Auswahl mit Optionen in Klammern: „Größe (S, M, L)“ oder „Essen: Fleisch / Fisch / Vegan“
  const paren = /^(.*?)\s*[([]\s*([^()[\]]+?)\s*[)\]]\s*$/.exec(label);
  const colon = /^([^:]+):\s*(.+\/.+)$/.exec(label);
  const optSrc = paren?.[2] ?? colon?.[2];
  if (optSrc && !YES_NO.test(optSrc)) {
    const opts = optSrc.split(/\s*(?:,|\/|\boder\b|\bor\b|\|)\s*/i).map((o) => cap(o.trim())).filter(Boolean);
    if (opts.length >= 2) {
      const base = (paren?.[1] ?? colon?.[1] ?? label).trim();
      const multi = /\b(mehrere|mehrfach|alle zutreffenden|multiple|interessen|themen|workshops)\b/i.test(base);
      return {
        type: multi ? "checkboxes" : opts.length <= 4 ? "single_choice" : "dropdown",
        label: cap(base.replace(/\b(mehrere|mehrfach|multiple)\b/i, "").trim()) || "Auswahl",
        options: [...new Set(opts)].slice(0, 50),
        required: required ?? true,
      };
    }
  }

  if (YES_NO.test(label)) {
    const base = label.replace(YES_NO, "").replace(/\s*[([]\s*[)\]]/g, "").replace(/[\s:–-]+$/, "").trim();
    return { type: "yes_no", label: cap(base.endsWith("?") ? base : base) || "Ja oder nein?", required };
  }

  for (const r of RULES) {
    if (r.re.test(label)) {
      const generic = r.label && label.split(" ").length <= 2;
      return { type: r.type, label: generic ? r.label! : cap(label), required: required ?? (r.type === "consent" ? true : undefined), ...r.extra };
    }
  }
  return { type: "short_text", label: cap(label), required };
}

/** Titel und Feldliste aus Freitext ableiten. */
export function parseDescription(text: string): SimpleForm {
  const src = text.trim().replace(/\s+/g, " ").slice(0, 4000);
  let title = "Neues Formular";
  let list = src;
  const m = /^(.{3,120}?)\s*(?:\bmit\b|\bwith\b|\bfragt?\b|\bfelder\b|:)\s*(.+)$/i.exec(src);
  if (m) {
    title = cap(m[1].replace(/^(ein|eine|einen|a|an|bitte|erstelle|create|baue|build)\s+/gi, "").replace(/\b(formular|form)\b\s*(für|for)?\s*/i, (x) => x).trim());
    list = m[2];
  } else if (!src.includes(",")) {
    title = cap(src.slice(0, 80));
    list = "";
  }
  title = title.replace(/[.:]+$/, "");
  const lower = src.toLowerCase();
  const mode: SimpleForm["mode"] = /eine frage pro|one question at a time|karten|cards/.test(lower) ? "cards" : /mehrstufig|schritte|steps|wizard|abschnitte/.test(lower) ? "wizard" : "classic";

  const fields = splitItems(list.replace(/\.$/, "")).map(itemToField);
  // Name/E-Mail-Paare ohne Pflichtangabe sind fast immer Pflicht.
  for (const f of fields) if (f.required === undefined && ["name", "email"].includes(f.type)) f.required = true;
  if (fields.length === 0) {
    fields.push({ type: "name", label: "Name", required: true }, { type: "email", label: "E-Mail", required: true }, { type: "long_text", label: "Nachricht", required: true });
  } else {
    // Ohne Kontaktfelder kann niemand antworten: Name und E-Mail vorne ergänzen
    const hasContact = fields.some((f) => f.type === "email" || f.type === "phone");
    if (!hasContact) {
      if (!fields.some((f) => f.type === "name")) fields.unshift({ type: "name", label: "Name", required: true });
      fields.splice(fields.findIndex((f) => f.type === "name") + 1, 0, { type: "email", label: "E-Mail", required: true });
    }
    // Personenbezogene Daten → Datenschutz-Einwilligung am Ende
    if (!fields.some((f) => f.type === "consent")) fields.push({ type: "consent", label: "Datenschutz", required: true });
    // Mindestens die erste inhaltliche Frage ist Pflicht, sonst sind leere Antworten möglich
    const first = fields.find((f) => !["name", "email", "phone", "consent", "heading", "paragraph", "divider"].includes(f.type));
    if (first && first.required === undefined) first.required = true;
  }
  return { title, mode, fields: fields.slice(0, 80) };
}

/** Vereinfachte Struktur (auch aus der KI) in eine echte Definition übersetzen. */
export function fromSimple(simple: SimpleForm): FormDefinition {
  const def = emptyDefinition((simple.title || "Neues Formular").slice(0, 300));
  def.description = simple.description?.slice(0, 4000) || undefined;
  def.settings.mode = simple.mode ?? "classic";
  const taken = new Set<string>();
  const fields: Field[] = [];
  for (const sf of simple.fields) {
    if (!sf || typeof sf.label !== "string") continue;
    let type = sf.type;
    if (type === "group" || type === "calculated" || type === "hidden" || type === "matrix" || type === "image") type = "short_text";
    const overrides: Partial<Field> = { label: sf.label.slice(0, 300) };
    if (sf.description) overrides.description = sf.description.slice(0, 1000);
    if (sf.required !== undefined && type !== "heading" && type !== "paragraph" && type !== "divider") overrides.required = sf.required;
    if (["dropdown", "single_choice", "multi_select", "checkboxes"].includes(type)) {
      const opts = [...new Set((sf.options ?? []).map((o) => String(o).trim().slice(0, 200)).filter(Boolean))];
      if (opts.length < 2) type = "short_text";
      else overrides.options = opts.map((o) => ({ id: newId("o_"), label: o, value: o }));
    }
    if (type === "consent") overrides.consentText = sf.description || "Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung gespeichert werden.";
    if (type === "date" && /geburt|birth/i.test(sf.label)) overrides.validation = { maxDate: "today" };
    const f = createField(type, taken, overrides);
    taken.add(f.key);
    fields.push(f);
  }
  // Im Wizard-Modus große Formulare in Abschnitte teilen (Einwilligung ans Ende).
  if (def.settings.mode === "wizard" && fields.length > 6) {
    const pages: Field[][] = [];
    for (let i = 0; i < fields.length; i += 5) pages.push(fields.slice(i, i + 5));
    def.pages = pages.map((fs, i) => ({ id: newId("p_"), title: `Schritt ${i + 1}`, fields: fs }));
  } else {
    def.pages[0].fields = fields;
  }
  return def;
}

export function generateForm(text: string): FormDefinition {
  return fromSimple(parseDescription(text));
}
