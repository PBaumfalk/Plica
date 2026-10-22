/**
 * „Häufig ergänzt“: kleine, begründete Feldvorschläge für den Editor.
 * Rein regelbasiert, ohne KI – nachvollziehbar und offline.
 */
import { walkFields, type Field, type FieldType, type FormDefinition } from "./schema";

export interface Suggestion {
  id: string;
  type: FieldType;
  title: string;
  reason: string;
  overrides?: Partial<Field>;
}

const PRIVACY_TEXT =
  "Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage gespeichert und verarbeitet werden. Die Einwilligung kann ich jederzeit widerrufen.";

export function suggestFields(def: Pick<FormDefinition, "pages" | "title">, max = 3): Suggestion[] {
  const types = new Map<FieldType, number>();
  const labels: string[] = [];
  for (const { field } of walkFields(def)) {
    types.set(field.type, (types.get(field.type) ?? 0) + 1);
    labels.push(field.label.toLowerCase());
  }
  const has = (t: FieldType) => (types.get(t) ?? 0) > 0;
  const labelHas = (re: RegExp) => labels.some((l) => re.test(l));
  const title = (def.title ?? "").toLowerCase();
  const out: Suggestion[] = [];

  const personal = has("email") || has("name") || has("phone") || has("address");
  if ((personal || has("file")) && !has("consent")) {
    out.push({
      id: "privacy-consent",
      type: "consent",
      title: "Datenschutz-Einwilligung",
      reason: has("file") && !personal ? "Hochgeladene Dokumente enthalten oft personenbezogene Daten." : "Das Formular erfasst personenbezogene Daten.",
      overrides: { label: "Datenschutz", consentText: PRIVACY_TEXT, required: true },
    });
  }
  if ((has("name") || has("signature") || has("address")) && !has("email")) {
    out.push({ id: "email", type: "email", title: "E-Mail", reason: "Damit Sie antworten und eine Bestätigung senden können.", overrides: { label: "E-Mail-Adresse", required: true } });
  }
  if ((has("signature") || has("address") || has("email")) && !has("name") && !labelHas(/name/)) {
    out.push({ id: "name", type: "name", title: "Name", reason: "Antworten lassen sich so eindeutig zuordnen.", overrides: { label: "Ihr Name", required: true } });
  }
  if (has("email") && has("long_text") && !has("phone")) {
    out.push({ id: "phone", type: "phone", title: "Telefon (optional)", reason: "Für Rückfragen ist ein Anruf oft schneller.", overrides: { label: "Telefon für Rückfragen" } });
  }
  if (has("signature") && !labelHas(/\bort\b/)) {
    out.push({ id: "place", type: "short_text", title: "Ort", reason: "Unterschriften werden üblicherweise mit Ort und Datum versehen.", overrides: { label: "Ort", required: true } });
  }
  if (/termin|anmeldung|veranstaltung|buchung/.test(title) && has("date") && !has("time") && !has("datetime")) {
    out.push({ id: "time", type: "time", title: "Uhrzeit", reason: "Bei Terminen hilft eine Wunschuhrzeit.", overrides: { label: "Wunschuhrzeit" } });
  }
  if (has("long_text") && !has("file") && /anfrage|mandat|aufnahme|schaden|bewerbung/.test(title)) {
    out.push({ id: "file", type: "file", title: "Dokumente", reason: "Unterlagen gleich mitschicken spart Rückfragen.", overrides: { label: "Unterlagen (optional)", maxFiles: 5 } });
  }
  if (types.size > 0 && !has("email") && !has("name") && !has("phone") && !has("hidden") && [...types.keys()].some((t) => t !== "heading" && t !== "paragraph")) {
    out.push({ id: "email-generic", type: "email", title: "E-Mail für Bestätigung", reason: "Ohne Kontaktfeld kann niemand eine Bestätigung erhalten.", overrides: { label: "E-Mail für die Bestätigung" } });
  }
  return out.slice(0, max);
}
