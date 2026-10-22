/**
 * Optionale KI-Anbindung (OpenAI-kompatible Chat-API, z. B. Ollama lokal).
 * Die KI liefert nur eine vereinfachte Feldliste; daraus baut die Engine
 * eine echte Definition, die validiert und analysiert wird. Bei jedem
 * Fehler greift der eingebaute Generator – PLICA funktioniert immer ohne KI.
 */
import "server-only";
import { analyze, hasBlockingIssues } from "@/lib/forms/analyze";
import { fromSimple, generateForm, type SimpleForm } from "@/lib/forms/generate";
import { FIELD_TYPES, FormSchemaV1, type FormDefinition } from "@/lib/forms/schema";
import { config } from "../config";

export type GenerateSource = "ai" | "builtin";

export function aiConfigured(): boolean {
  const c = config();
  return !!(c.AI_BASE_URL && c.AI_MODEL);
}

const SYSTEM = `Du entwirfst Online-Formulare. Antworte ausschließlich mit JSON in genau dieser Form:
{"title": string, "description": string, "mode": "classic"|"cards"|"wizard", "fields": [{"type": string, "label": string, "required": boolean, "options"?: string[], "description"?: string}]}
Erlaubte type-Werte: short_text, long_text, email, phone, number, currency, date, time, datetime, date_range, dropdown, single_choice, multi_select, checkboxes, yes_no, name, address, file, signature, rating, slider, consent, heading, paragraph.
Regeln: höchstens 25 Felder; Beschriftungen kurz und in der Sprache der Beschreibung; options nur bei dropdown, single_choice, multi_select, checkboxes; bei personenbezogenen Daten eine consent-Frage am Ende; keine Erklärungen außerhalb des JSON.`;

async function callAi(text: string): Promise<FormDefinition> {
  const c = config();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${c.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(c.AI_API_KEY ? { authorization: `Bearer ${c.AI_API_KEY}` } : {}) },
      body: JSON.stringify({
        model: c.AI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text.slice(0, 4000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`KI-Dienst antwortet mit ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(content.replace(/^```(?:json)?|```$/g, "").trim()) as Partial<SimpleForm>;
    if (!json || !Array.isArray(json.fields) || json.fields.length === 0) throw new Error("KI lieferte keine Felder");
    const allowed = new Set<string>(FIELD_TYPES);
    const simple: SimpleForm = {
      title: String(json.title ?? "Neues Formular"),
      description: typeof json.description === "string" ? json.description : undefined,
      mode: json.mode === "cards" || json.mode === "wizard" ? json.mode : "classic",
      fields: json.fields
        .slice(0, 25)
        .filter((f) => f && typeof f.label === "string" && allowed.has(String(f.type)))
        .map((f) => ({ type: f.type, label: f.label, required: !!f.required, options: Array.isArray(f.options) ? f.options.map(String) : undefined, description: typeof f.description === "string" ? f.description : undefined })),
    };
    const def = FormSchemaV1.parse(fromSimple(simple));
    if (hasBlockingIssues(analyze(def))) throw new Error("KI-Entwurf enthält Fehler");
    return def;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateDefinition(text: string): Promise<{ definition: FormDefinition; source: GenerateSource; note?: string }> {
  if (aiConfigured()) {
    try {
      return { definition: await callAi(text), source: "ai" };
    } catch (e) {
      console.warn("[ai] Fallback auf eingebauten Generator:", e instanceof Error ? e.message : e);
      return { definition: FormSchemaV1.parse(generateForm(text)), source: "builtin", note: "Der KI-Dienst war nicht erreichbar oder lieferte kein brauchbares Ergebnis. Der eingebaute Generator hat übernommen." };
    }
  }
  return { definition: FormSchemaV1.parse(generateForm(text)), source: "builtin" };
}
