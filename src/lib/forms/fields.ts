/**
 * Feldregister: Anzeigenamen, Kategorien und Standardkonfiguration.
 * Icons ordnet die UI-Schicht zu (src/components/builder/field-icons.tsx).
 */
import type { Field, FieldType, FormDefinition, Option } from "./schema";

export type Category = "text" | "choice" | "date" | "number" | "contact" | "media" | "advanced" | "layout";

export const CATEGORY_LABELS: Record<Category, string> = {
  text: "Text",
  choice: "Auswahl",
  number: "Zahlen",
  date: "Datum und Zeit",
  contact: "Kontakt",
  media: "Dateien und Unterschrift",
  advanced: "Fortgeschritten",
  layout: "Gestaltung",
};

export const FIELD_META: Record<FieldType, { label: string; category: Category; hint: string; keywords: string }> = {
  short_text: { label: "Kurzer Text", category: "text", hint: "Eine Zeile", keywords: "text eingabe input zeile" },
  long_text: { label: "Langer Text", category: "text", hint: "Mehrere Zeilen", keywords: "textarea absatz nachricht beschreibung" },
  email: { label: "E-Mail", category: "contact", hint: "Geprüfte Adresse", keywords: "mail email" },
  phone: { label: "Telefon", category: "contact", hint: "Telefonnummer", keywords: "telefon handy mobil nummer" },
  name: { label: "Name", category: "contact", hint: "Vor- und Nachname", keywords: "vorname nachname person" },
  address: { label: "Adresse", category: "contact", hint: "Straße, PLZ, Ort", keywords: "anschrift straße plz ort land" },
  number: { label: "Zahl", category: "number", hint: "Ganze oder Dezimalzahl", keywords: "anzahl menge zahl" },
  currency: { label: "Betrag", category: "number", hint: "Geldbetrag mit Währung", keywords: "euro preis geld währung betrag" },
  slider: { label: "Schieberegler", category: "number", hint: "Wert auf einer Skala", keywords: "slider skala bereich" },
  rating: { label: "Bewertung", category: "number", hint: "Sterne oder Punkte", keywords: "sterne rating zufriedenheit" },
  calculated: { label: "Berechnung", category: "advanced", hint: "Formel aus anderen Antworten", keywords: "formel rechnen summe calculated" },
  date: { label: "Datum", category: "date", hint: "Ein Tag", keywords: "datum tag geburtstag" },
  time: { label: "Uhrzeit", category: "date", hint: "Stunden und Minuten", keywords: "zeit uhr" },
  datetime: { label: "Datum mit Uhrzeit", category: "date", hint: "Termin", keywords: "termin datum zeit" },
  date_range: { label: "Zeitraum", category: "date", hint: "Von – bis", keywords: "zeitraum spanne von bis urlaub" },
  dropdown: { label: "Dropdown", category: "choice", hint: "Eine aus vielen Optionen", keywords: "auswahl liste select" },
  single_choice: { label: "Einfachauswahl", category: "choice", hint: "Genau eine Option", keywords: "radio option eine" },
  multi_select: { label: "Mehrfachauswahl", category: "choice", hint: "Mehrere als Chips", keywords: "mehrere tags chips" },
  checkboxes: { label: "Checkboxen", category: "choice", hint: "Mehrere ankreuzen", keywords: "häkchen ankreuzen checkbox" },
  yes_no: { label: "Ja / Nein", category: "choice", hint: "Zwei Antworten", keywords: "ja nein boolean" },
  matrix: { label: "Matrix", category: "choice", hint: "Mehrere Aussagen bewerten", keywords: "tabelle likert raster" },
  file: { label: "Datei-Upload", category: "media", hint: "Dokumente und Bilder", keywords: "datei upload anhang pdf dokument" },
  signature: { label: "Unterschrift", category: "media", hint: "Einfache elektronische Unterschrift", keywords: "signatur unterschreiben" },
  consent: { label: "Einwilligung", category: "advanced", hint: "Zustimmung mit Text", keywords: "datenschutz zustimmung dsgvo agb" },
  group: { label: "Wiederholgruppe", category: "advanced", hint: "Mehrere gleiche Einträge", keywords: "gruppe wiederholen liste personen positionen" },
  hidden: { label: "Verstecktes Feld", category: "advanced", hint: "Wert aus dem Link", keywords: "hidden versteckt utm quelle" },
  heading: { label: "Überschrift", category: "layout", hint: "Abschnitt gliedern", keywords: "titel überschrift abschnitt" },
  paragraph: { label: "Infotext", category: "layout", hint: "Erklärung ohne Eingabe", keywords: "text hinweis info absatz" },
  divider: { label: "Trennlinie", category: "layout", hint: "Optische Trennung", keywords: "linie trenner" },
  image: { label: "Bild", category: "layout", hint: "Grafik oder Foto", keywords: "bild foto logo grafik" },
};

export function newId(prefix = ""): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return prefix + s;
}

/** Aus einem Label einen lesbaren, eindeutigen Feldschlüssel ableiten. */
export function slugKey(label: string, taken: Set<string>, fallback = "feld"): string {
  const base =
    label
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^[^a-z]+/, "")
      .slice(0, 40) || fallback;
  let key = base;
  let i = 2;
  while (taken.has(key)) key = `${base}_${i++}`;
  return key;
}

export function options(...labels: string[]): Option[] {
  return labels.map((l) => ({ id: newId("o_"), label: l, value: l }));
}

export function allKeys(def: Pick<FormDefinition, "pages">): Set<string> {
  const keys = new Set<string>();
  for (const p of def.pages) for (const f of p.fields) {
    keys.add(f.key);
    for (const c of f.fields ?? []) keys.add(c.key);
  }
  return keys;
}

/** Neues Feld mit sinnvollen Voreinstellungen. */
export function createField(type: FieldType, taken: Set<string>, overrides: Partial<Field> = {}): Field {
  const meta = FIELD_META[type];
  const label = overrides.label ?? (type === "divider" ? "" : meta.label);
  const base: Field = { id: newId("f_"), type, key: slugKey(overrides.key ?? label, taken, type), label };
  switch (type) {
    case "dropdown":
    case "single_choice":
    case "multi_select":
    case "checkboxes":
      base.options = options("Option 1", "Option 2", "Option 3");
      break;
    case "name":
      // Name und E-Mail werden in fast jedem Formular gebraucht – standardmäßig Pflicht
      base.nameParts = ["first", "last"];
      base.required = true;
      break;
    case "email":
      base.required = true;
      break;
    case "long_text":
      base.label = overrides.label ?? "Nachricht";
      base.key = slugKey(overrides.key ?? base.label, taken, type);
      break;
    case "address":
      base.addressParts = ["street", "postalCode", "city", "country"];
      base.defaultCountry = "Deutschland";
      break;
    case "currency":
      base.currency = "EUR";
      base.decimals = 2;
      break;
    case "rating":
      base.ratingMax = 5;
      base.ratingIcon = "star";
      break;
    case "slider":
      base.validation = { min: 0, max: 10, step: 1 };
      break;
    case "matrix":
      base.matrix = {
        rows: options("Aussage 1", "Aussage 2"),
        columns: options("Trifft nicht zu", "Teils", "Trifft zu"),
        multiple: false,
      };
      break;
    case "file":
      base.maxFiles = 1;
      base.maxFileSizeMb = 10;
      base.accept = ["application/pdf", "image/jpeg", "image/png"];
      break;
    case "consent":
      base.label = "Einwilligung";
      base.consentText = "Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage gespeichert werden.";
      base.required = true;
      break;
    case "group":
      base.label = "Einträge";
      base.itemLabel = "Eintrag";
      base.minItems = 0;
      base.maxItems = 10;
      base.fields = [];
      break;
    case "heading":
      base.level = 2;
      break;
    case "calculated":
      base.expression = "";
      break;
    case "hidden":
      base.label = "Quelle";
      base.key = slugKey("quelle", taken);
      base.urlParam = "quelle";
      break;
  }
  return { ...base, ...overrides, id: overrides.id ?? base.id, key: overrides.key ? slugKey(overrides.key, taken) : base.key };
}

/** Tiefe Kopie mit neuen IDs und Schlüsseln (Duplizieren, Bausteine). */
export function cloneField(field: Field, taken: Set<string>): Field {
  const copy: Field = JSON.parse(JSON.stringify(field));
  copy.id = newId("f_");
  copy.key = slugKey(field.key, taken);
  taken.add(copy.key);
  if (copy.options) copy.options = copy.options.map((o) => ({ ...o, id: newId("o_") }));
  if (copy.fields) copy.fields = copy.fields.map((c) => cloneField(c, taken));
  return copy;
}

export function emptyDefinition(title = "Unbenanntes Formular"): FormDefinition {
  return {
    version: 1,
    title,
    pages: [{ id: newId("p_"), title: "", fields: [] }],
    rules: [],
    endings: [{ id: newId("e_"), title: "Vielen Dank!", body: "Ihre Angaben sind bei uns eingegangen." }],
    settings: {
      mode: "classic",
      showProgress: true,
      reviewStep: true,
      submitLabel: "Absenden",
      language: "de",
      allowResume: false,
      theme: { accent: "#0b5c66", radius: "medium", font: "sans", background: "plain" },
    },
  };
}
