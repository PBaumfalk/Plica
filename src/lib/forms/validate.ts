/**
 * Validierung und Normalisierung von Antworten.
 *
 * Der Server ruft `validateSubmission` mit den rohen, nicht
 * vertrauenswürdigen Daten auf und speichert ausschließlich `values`.
 * Der Browser nutzt dieselbe Funktion für sofortiges Feedback.
 */
import { RE2JS } from "re2js";
import { toNumber } from "./number";

export { toNumber };
import { computeState, isEmpty, type Answers, type FormState } from "./logic";
import { fieldIndex, isInputField, type Field, type FormDefinition } from "./schema";

export type Lang = "de" | "en";

const MSG = {
  de: {
    required: "Bitte ausfüllen.",
    requiredChoice: "Bitte auswählen.",
    requiredConsent: "Bitte bestätigen.",
    requiredFile: "Bitte eine Datei hochladen.",
    requiredSignature: "Bitte unterschreiben.",
    email: "Bitte eine gültige E-Mail-Adresse eingeben, z. B. name@beispiel.de.",
    phone: "Bitte eine gültige Telefonnummer eingeben.",
    number: "Bitte eine Zahl eingeben.",
    integerStep: (s: number) => `Bitte in Schritten von ${s} angeben.`,
    min: (n: string) => `Mindestens ${n}.`,
    max: (n: string) => `Höchstens ${n}.`,
    minLength: (n: number) => `Mindestens ${n} Zeichen.`,
    maxLength: (n: number) => `Höchstens ${n} Zeichen.`,
    pattern: "Das Format passt nicht.",
    date: "Bitte ein gültiges Datum eingeben.",
    time: "Bitte eine gültige Uhrzeit eingeben.",
    dateMin: (d: string) => `Frühestens ${d}.`,
    dateMax: (d: string) => `Spätestens ${d}.`,
    range: "Das Enddatum liegt vor dem Startdatum.",
    option: "Diese Auswahl ist nicht möglich.",
    minSelected: (n: number) => `Bitte mindestens ${n} auswählen.`,
    maxSelected: (n: number) => `Bitte höchstens ${n} auswählen.`,
    nameParts: "Bitte Vor- und Nachnamen angeben.",
    address: "Bitte Straße, PLZ und Ort angeben.",
    matrix: "Bitte jede Zeile beantworten.",
    groupMin: (n: number) => (n === 1 ? "Bitte mindestens einen Eintrag hinzufügen." : `Bitte mindestens ${n} Einträge hinzufügen.`),
    groupMax: (n: number) => `Höchstens ${n} Einträge.`,
    files: (n: number) => `Höchstens ${n} Dateien.`,
    invalid: "Ungültige Eingabe.",
  },
  en: {
    required: "This field is required.",
    requiredChoice: "Please choose an option.",
    requiredConsent: "Please confirm.",
    requiredFile: "Please upload a file.",
    requiredSignature: "Please sign.",
    email: "Please enter a valid email address.",
    phone: "Please enter a valid phone number.",
    number: "Please enter a number.",
    integerStep: (s: number) => `Use steps of ${s}.`,
    min: (n: string) => `At least ${n}.`,
    max: (n: string) => `At most ${n}.`,
    minLength: (n: number) => `At least ${n} characters.`,
    maxLength: (n: number) => `At most ${n} characters.`,
    pattern: "The format doesn't match.",
    date: "Please enter a valid date.",
    time: "Please enter a valid time.",
    dateMin: (d: string) => `${d} or later.`,
    dateMax: (d: string) => `${d} or earlier.`,
    range: "The end date is before the start date.",
    option: "This option is not available.",
    minSelected: (n: number) => `Choose at least ${n}.`,
    maxSelected: (n: number) => `Choose at most ${n}.`,
    nameParts: "Please enter first and last name.",
    address: "Please enter street, postal code and city.",
    matrix: "Please answer every row.",
    groupMin: (n: number) => (n === 1 ? "Add at least one entry." : `Add at least ${n} entries.`),
    groupMax: (n: number) => `At most ${n} entries.`,
    files: (n: number) => `At most ${n} files.`,
    invalid: "Invalid input.",
  },
} as const;

export function messages(lang: Lang) {
  return MSG[lang] ?? MSG.de;
}

// Pragmatisch: RFC 5322 ist für Formulare zu großzügig.
const EMAIL = /^[^\s@"<>()[\]\\,;:]{1,64}@(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PHONE = /^\+?[0-9 ()/.-]{5,30}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const SIGNATURE_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
export const SIGNATURE_MAX_BYTES = 400_000;

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** „today“, „+30d“, „-18y“, „+2m“ oder ISO-Datum → ISO-Datum. */
export function resolveDate(spec: string, now = new Date()): string | null {
  if (validDate(spec)) return spec;
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (spec === "today") return d.toISOString().slice(0, 10);
  const m = /^([+-]\d{1,4})([dmy])$/.exec(spec);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === "d") d.setUTCDate(d.getUTCDate() + n);
  if (m[2] === "m") d.setUTCMonth(d.getUTCMonth() + n);
  if (m[2] === "y") d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-");
  return lang === "de" ? `${d}.${m}.${y}` : iso;
}

const regexCache = new Map<string, RE2JS | null>();
/** RE2: garantiert lineare Laufzeit – kein ReDoS durch Formularersteller. */
export function compilePattern(pattern: string): RE2JS | null {
  if (regexCache.has(pattern)) return regexCache.get(pattern)!;
  let re: RE2JS | null = null;
  try {
    re = RE2JS.compile(pattern);
  } catch {
    re = null;
  }
  if (regexCache.size > 500) regexCache.clear();
  regexCache.set(pattern, re);
  return re;
}

export function patternError(pattern: string): string | null {
  try {
    RE2JS.compile(pattern);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Ungültiger Ausdruck";
  }
}

function optionValues(f: Field): Set<string> {
  return new Set((f.options ?? []).map((o) => o.value));
}

export interface FileRef {
  id: string;
  name: string;
  size: number;
  type: string;
}

function isFileRef(v: unknown): v is FileRef {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(o.id) && typeof o.name === "string" && typeof o.size === "number" && typeof o.type === "string";
}

type Result = { value: unknown; error?: string };

/**
 * Normalisiert einen einzelnen Wert und prüft ihn.
 * `required` kommt aus dem Logik-Zustand (Regeln können Pflicht erzwingen).
 */
export function checkField(field: Field, raw: unknown, required: boolean, lang: Lang = "de", now = new Date()): Result {
  const M = messages(lang);
  const custom = field.messages ?? {};
  const v = field.validation ?? {};
  const req = (msg: string = M.required): Result => ({ value: undefined, error: custom.required || msg });
  const bad = (msg: string): Result => ({ value: raw, error: custom.invalid || msg });

  switch (field.type) {
    case "short_text":
    case "long_text":
    case "email":
    case "phone":
    case "hidden": {
      if (raw !== undefined && raw !== null && typeof raw !== "string" && typeof raw !== "number") return bad(M.invalid);
      const s = raw === undefined || raw === null ? "" : String(raw).replace(/\r\n/g, "\n");
      const value = field.type === "long_text" ? s.trim() : s.trim().replace(/\s+/g, " ");
      if (!value) return required ? req() : { value: undefined };
      const max = Math.min(v.maxLength ?? (field.type === "long_text" ? 20_000 : 1_000), 100_000);
      if (value.length > max) return bad(M.maxLength(max));
      if (v.minLength && value.length < v.minLength) return bad(M.minLength(v.minLength));
      if (field.type === "email" && !EMAIL.test(value)) return bad(M.email);
      if (field.type === "phone" && (!PHONE.test(value) || value.replace(/\D/g, "").length < 5)) return bad(M.phone);
      if (v.pattern) {
        const re = compilePattern(v.pattern);
        if (re && !re.matcher(value).find()) return { value, error: custom.pattern || M.pattern };
      }
      return { value: field.type === "email" ? value.toLowerCase() : value };
    }
    case "number":
    case "currency":
    case "slider":
    case "rating": {
      if (raw === undefined || raw === null || raw === "") return required ? req() : { value: undefined };
      const n = toNumber(raw);
      if (n === null) return bad(M.number);
      if (field.type === "rating") {
        const max = field.ratingMax ?? 5;
        if (!Number.isInteger(n) || n < 1 || n > max) return bad(M.invalid);
        return { value: n };
      }
      const min = field.type === "slider" ? (v.min ?? 0) : v.min;
      const max = field.type === "slider" ? (v.max ?? 100) : v.max;
      if (min !== undefined && n < min) return bad(M.min(String(min)));
      if (max !== undefined && n > max) return bad(M.max(String(max)));
      const decimals = field.type === "currency" ? (field.decimals ?? 2) : field.decimals;
      if (v.step && Math.abs(Math.round((n - (min ?? 0)) / v.step) * v.step - (n - (min ?? 0))) > 1e-9) return bad(M.integerStep(v.step));
      const value = decimals !== undefined ? Math.round(n * 10 ** decimals) / 10 ** decimals : n;
      return { value };
    }
    case "date": {
      if (isEmpty(raw)) return required ? req() : { value: undefined };
      if (typeof raw !== "string" || !validDate(raw)) return bad(M.date);
      const min = v.minDate ? resolveDate(v.minDate, now) : null;
      const max = v.maxDate ? resolveDate(v.maxDate, now) : null;
      if (min && raw < min) return bad(M.dateMin(fmtDate(min, lang)));
      if (max && raw > max) return bad(M.dateMax(fmtDate(max, lang)));
      return { value: raw };
    }
    case "time": {
      if (isEmpty(raw)) return required ? req() : { value: undefined };
      if (typeof raw !== "string" || !TIME.test(raw)) return bad(M.time);
      return { value: raw };
    }
    case "datetime": {
      if (isEmpty(raw)) return required ? req() : { value: undefined };
      if (typeof raw !== "string" || !DATETIME.test(raw) || !validDate(raw.slice(0, 10))) return bad(M.date);
      return { value: raw };
    }
    case "date_range": {
      const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const start = typeof o.start === "string" ? o.start : "";
      const end = typeof o.end === "string" ? o.end : "";
      if (!start && !end) return required ? req() : { value: undefined };
      if (!validDate(start) || !validDate(end)) return bad(M.date);
      if (end < start) return bad(M.range);
      const min = v.minDate ? resolveDate(v.minDate, now) : null;
      const max = v.maxDate ? resolveDate(v.maxDate, now) : null;
      if (min && start < min) return bad(M.dateMin(fmtDate(min, lang)));
      if (max && end > max) return bad(M.dateMax(fmtDate(max, lang)));
      return { value: { start, end } };
    }
    case "dropdown":
    case "single_choice": {
      if (isEmpty(raw)) return required ? req(M.requiredChoice) : { value: undefined };
      if (typeof raw !== "string") return bad(M.option);
      const val = raw.trim().slice(0, 500);
      if (!optionValues(field).has(val)) {
        if (field.allowOther && val.startsWith("other:") && val.length > 6) return { value: val };
        return bad(M.option);
      }
      return { value: val };
    }
    case "multi_select":
    case "checkboxes": {
      const arr = Array.isArray(raw) ? raw : isEmpty(raw) ? [] : [raw];
      if (arr.length === 0) return required ? req(M.requiredChoice) : { value: undefined };
      const allowed = optionValues(field);
      const out: string[] = [];
      for (const x of arr) {
        if (typeof x !== "string") return bad(M.option);
        const val = x.trim().slice(0, 500);
        if (!allowed.has(val) && !(field.allowOther && val.startsWith("other:") && val.length > 6)) return bad(M.option);
        if (!out.includes(val)) out.push(val);
      }
      if (out.length > 500) return bad(M.option);
      if (v.minSelected && out.length < v.minSelected) return bad(M.minSelected(v.minSelected));
      if (v.maxSelected && out.length > v.maxSelected) return bad(M.maxSelected(v.maxSelected));
      return { value: out };
    }
    case "yes_no": {
      if (raw === undefined || raw === null || raw === "") return required ? req(M.requiredChoice) : { value: undefined };
      if (raw === true || raw === "true" || raw === "yes") return { value: true };
      if (raw === false || raw === "false" || raw === "no") return { value: false };
      return bad(M.invalid);
    }
    case "consent": {
      const yes = raw === true || raw === "true" || raw === "on";
      if (!yes) return required ? req(M.requiredConsent) : { value: undefined };
      return { value: true };
    }
    case "name": {
      const parts = field.nameParts ?? ["first", "last"];
      const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const value: Record<string, string> = {};
      for (const p of parts) {
        const s = typeof o[p] === "string" ? (o[p] as string).trim().replace(/\s+/g, " ").slice(0, 200) : "";
        if (s) value[p] = s;
      }
      if (Object.keys(value).length === 0) return required ? req() : { value: undefined };
      const mandatory = parts.filter((p) => p === "first" || p === "last");
      if (required && mandatory.some((p) => !value[p])) return { value, error: custom.required || M.nameParts };
      return { value };
    }
    case "address": {
      const parts = field.addressParts ?? ["street", "postalCode", "city", "country"];
      const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const value: Record<string, string> = {};
      for (const p of parts) {
        const s = typeof o[p] === "string" ? (o[p] as string).trim().replace(/\s+/g, " ").slice(0, 300) : "";
        if (s) value[p] = s;
      }
      const meaningful = Object.entries(value).filter(([k]) => !(k === "country" && value[k] === field.defaultCountry));
      if (meaningful.length === 0) return required ? req() : { value: undefined };
      const need = (["street", "postalCode", "city"] as const).filter((p) => parts.includes(p));
      if (need.some((p) => !value[p])) return { value, error: custom.required || M.address };
      return { value };
    }
    case "matrix": {
      const mx = field.matrix;
      if (!mx) return { value: undefined };
      const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
      const cols = new Set(mx.columns.map((c) => c.value));
      const value: Record<string, string | string[]> = {};
      for (const row of mx.rows) {
        const cell = o[row.id];
        if (mx.multiple) {
          const arr = (Array.isArray(cell) ? cell : []).filter((x): x is string => typeof x === "string" && cols.has(x));
          if (arr.length) value[row.id] = [...new Set(arr)];
        } else if (typeof cell === "string" && cell) {
          if (!cols.has(cell)) return bad(M.option);
          value[row.id] = cell;
        }
      }
      if (Object.keys(value).length === 0) return required ? req(M.matrix) : { value: undefined };
      if (required && mx.rows.some((r) => !value[r.id])) return { value, error: custom.required || M.matrix };
      return { value };
    }
    case "file": {
      const arr = Array.isArray(raw) ? raw : [];
      if (arr.length === 0) return required ? req(M.requiredFile) : { value: undefined };
      if (!arr.every(isFileRef)) return bad(M.invalid);
      const max = field.maxFiles ?? 1;
      if (arr.length > max) return bad(M.files(max));
      return { value: arr.map((f) => ({ id: f.id, name: f.name.slice(0, 255), size: f.size, type: f.type.slice(0, 120) })) };
    }
    case "signature": {
      if (isEmpty(raw)) return required ? req(M.requiredSignature) : { value: undefined };
      const o = raw as Record<string, unknown>;
      // Im Browser: Data-URL; nach Speicherung: Datei-Referenz.
      if (typeof o === "object" && typeof o.dataUrl === "string") {
        if (o.dataUrl.length > SIGNATURE_MAX_BYTES * 1.4 || !SIGNATURE_DATA_URL.test(o.dataUrl)) return bad(M.invalid);
        return { value: { dataUrl: o.dataUrl } };
      }
      if (typeof o === "object" && typeof o.fileId === "string") return { value: o };
      return bad(M.invalid);
    }
    case "calculated":
    case "group":
    case "heading":
    case "paragraph":
    case "divider":
    case "image":
      return { value: undefined };
  }
}

export interface ValidationResult {
  ok: boolean;
  /** Schlüssel: Feld-ID, bei Gruppen `gruppeId.index.feldId`. */
  errors: Record<string, string>;
  values: Answers;
  state: FormState;
}

/**
 * Prüft Antworten gegen Definition und Logik.
 * @param onlyPages  nur diese Seiten prüfen (Schritt-für-Schritt-Navigation)
 */
export function validateSubmission(
  def: FormDefinition,
  raw: Answers,
  opts: { onlyPages?: string[]; lang?: Lang; now?: Date } = {},
): ValidationResult {
  const lang = opts.lang ?? def.settings.language ?? "de";
  const M = messages(lang);
  const index = fieldIndex(def);

  // Erst normalisieren (ohne Fehler), damit die Logik mit sauberen Werten rechnet.
  const pre: Answers = {};
  for (const { field, parent } of index.values()) {
    if (parent || !isInputField(field) || !(field.id in raw)) continue;
    if (field.type === "group") pre[field.id] = raw[field.id];
    else pre[field.id] = checkField(field, raw[field.id], false, lang, opts.now).value;
  }
  const state = computeState(def, pre);
  const pagesToCheck = opts.onlyPages ? new Set(opts.onlyPages) : null;

  const errors: Record<string, string> = {};
  const values: Answers = {};
  for (const { field, page, parent } of index.values()) {
    if (parent || !isInputField(field)) continue;
    if (!state.visible.has(field.id)) continue;
    if (pagesToCheck && !pagesToCheck.has(page.id)) {
      // Nicht geprüfte Seiten trotzdem übernehmen (Zwischenstand)
      if (field.id in pre && pre[field.id] !== undefined) values[field.id] = pre[field.id];
      continue;
    }
    if (field.type === "calculated") {
      const c = state.computed[field.id];
      if (c !== null && c !== undefined) values[field.id] = c;
      continue;
    }
    if (field.type === "group") {
      const items = Array.isArray(raw[field.id]) ? (raw[field.id] as unknown[]).slice(0, 50) : [];
      const outItems: Answers[] = [];
      items.forEach((item, i) => {
        const obj = (item && typeof item === "object" ? item : {}) as Answers;
        const out: Answers = {};
        for (const child of field.fields ?? []) {
          if (!isInputField(child) || child.type === "group" || child.type === "file" || child.type === "signature") continue;
          const r = checkField(child, obj[child.id], !!child.required && state.visible.has(child.id), lang, opts.now);
          if (r.error) errors[`${field.id}.${i}.${child.id}`] = r.error;
          if (r.value !== undefined) out[child.id] = r.value;
        }
        if (Object.keys(out).length) outItems.push(out);
      });
      // Nicht Pflicht = darf leer bleiben; Pflicht = mindestens minItems (wenigstens 1)
      const min = state.required.has(field.id) ? Math.max(1, field.minItems ?? 1) : 0;
      if (outItems.length < min) errors[field.id] = field.messages?.required || M.groupMin(min);
      if (field.maxItems && outItems.length > field.maxItems) errors[field.id] = M.groupMax(field.maxItems);
      if (outItems.length) values[field.id] = outItems;
      continue;
    }
    const r = checkField(field, raw[field.id], state.required.has(field.id), lang, opts.now);
    if (r.error) errors[field.id] = r.error;
    if (r.value !== undefined) values[field.id] = r.value;
  }
  return { ok: Object.keys(errors).length === 0, errors, values, state };
}
