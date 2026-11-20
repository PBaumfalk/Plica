/** Anrede-Name für Begrüßungen: erster Vorname ohne akademische Titel („Dr. Anna Beispiel“ → „Anna“). */
const TITLE = /^(dr|prof|dipl|mag|lic|ll|ra|rain|jur|med|phil|rer|nat|habil|h\.?\s*c)\b|\.$/i;

export function greetingName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const rest = parts.filter((p) => !TITLE.test(p));
  return rest[0] ?? parts.at(-1) ?? "";
}
