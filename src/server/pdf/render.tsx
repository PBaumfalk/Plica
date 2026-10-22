/**
 * PDF einer Antwort erzeugen. Wird von der Oberfläche (Download, Vorschau)
 * und vom Worker (Workflow-Schritt „PDF erzeugen“, E-Mail-Anhang) genutzt.
 */
import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, desc, eq } from "drizzle-orm";
import { formatDate, formatValue } from "@/lib/forms/format";
import { fieldIndex, isInputField, type Field, type FormDefinition } from "@/lib/forms/schema";
import { db, schema } from "../db";
import { sha256 } from "../lib/crypto";
import { getObject } from "../storage/s3";
import { NotFound } from "../forms/service";
import { STATUS_LABELS } from "../submissions/labels";
import { getSubmission } from "../submissions/service";
import { SubmissionDocument, type PdfAnswer, type PdfModel, type PdfSection, type PdfSignature } from "./document";
import { DEFAULT_TEMPLATE, parseTemplate } from "./template";

/** Stabiles JSON (sortierte Schlüssel) – gleiche Daten ergeben dieselbe Prüfsumme. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

function berlin(d: Date) {
  return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "short" }) + " Uhr";
}

function fmtSize(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function answerFor(field: Field, value: unknown): PdfAnswer | null {
  if (value === undefined || value === null || value === "") return null;
  const label = field.label || field.key;
  switch (field.type) {
    case "signature":
      return null;
    case "file":
      return { label, lines: Array.isArray(value) ? value.map((f) => `${(f as { name: string }).name} (${fmtSize((f as { size: number }).size)})`) : [] };
    case "matrix": {
      const o = value as Record<string, string | string[]>;
      const cols = new Map((field.matrix?.columns ?? []).map((c) => [c.value, c.label]));
      return { label, lines: (field.matrix?.rows ?? []).filter((r) => o[r.id]).map((r) => `${r.label}: ${[o[r.id]].flat().map((c) => cols.get(c) ?? c).join(", ")}`) };
    }
    case "group": {
      if (!Array.isArray(value)) return null;
      return {
        label,
        lines: [],
        group: value.map((item, i) => ({
          title: `${field.itemLabel ?? "Eintrag"} ${i + 1}`,
          rows: (field.fields ?? [])
            .filter(isInputField)
            .map((c) => ({ label: c.label || c.key, value: formatValue(c, (item as Record<string, unknown>)[c.id]) }))
            .filter((r) => r.value),
        })),
      };
    }
    default: {
      const text = formatValue(field, value);
      return text ? { label, lines: text.split("\n") } : null;
    }
  }
}

export function buildSections(def: FormDefinition, data: Record<string, unknown>): PdfSection[] {
  const sections: PdfSection[] = [];
  for (const page of def.pages) {
    const answers = page.fields.filter(isInputField).map((f) => answerFor(f, data[f.id])).filter((a): a is PdfAnswer => !!a);
    if (answers.length) sections.push({ title: def.pages.length > 1 ? page.title : "", answers });
  }
  return sections;
}

interface ModelInput {
  workspaceName: string;
  definition: FormDefinition;
  data: Record<string, unknown>;
  number: number;
  submittedAt: Date;
  version: number;
  status: string;
  id: string;
  signatures: PdfSignature[];
  templateBody: string | null;
}

export function buildModel(i: ModelInput): PdfModel {
  const index = fieldIndex(i.definition);
  const byKey = new Map([...index.values()].map((e) => [e.field.key, e.field]));
  const resolve = (name: string) => {
    switch (name) {
      case "datum": return formatDate(new Date().toISOString().slice(0, 10));
      case "eingang": return berlin(i.submittedAt);
      case "nummer": return String(i.number);
      case "formular": return i.definition.title;
      case "id": return i.id;
    }
    const f = byKey.get(name);
    return f ? formatValue(f, i.data[f.id]) : "";
  };
  return {
    workspace: i.workspaceName,
    formTitle: i.definition.title,
    number: i.number,
    submittedAt: berlin(i.submittedAt),
    version: i.version,
    status: i.status,
    id: i.id,
    dataHash: sha256(stableJson(i.data)),
    sections: buildSections(i.definition, i.data),
    signatures: i.signatures,
    template: i.templateBody ? parseTemplate(i.templateBody, resolve) : null,
  };
}

async function workspaceName(workspaceId: string) {
  const w = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, workspaceId), columns: { name: true } });
  return w?.name ?? "";
}

async function templateFor(workspaceId: string, formId: string, opts: { templateId?: string; templateBody?: string }) {
  if (opts.templateBody !== undefined) return opts.templateBody.slice(0, 50_000);
  if (opts.templateId) {
    const t = await db.query.pdfTemplates.findFirst({ where: and(eq(schema.pdfTemplates.id, opts.templateId), eq(schema.pdfTemplates.workspaceId, workspaceId), eq(schema.pdfTemplates.formId, formId)) });
    if (!t) throw new NotFound("PDF-Vorlage");
    return t.body;
  }
  const t = await db.query.pdfTemplates.findFirst({ where: and(eq(schema.pdfTemplates.workspaceId, workspaceId), eq(schema.pdfTemplates.formId, formId), eq(schema.pdfTemplates.isDefault, true)) });
  return t?.body ?? null;
}

function safeName(title: string) {
  return (title || "formular").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60).toLowerCase() || "formular";
}

export async function renderSubmissionPdf(workspaceId: string, submissionId: string, opts: { templateId?: string; templateBody?: string } = {}): Promise<{ buffer: Buffer; filename: string }> {
  const { submission, version, definition } = await getSubmission(workspaceId, submissionId);
  const index = fieldIndex(definition);
  const signatures: PdfSignature[] = [];
  for (const [fid, v] of Object.entries(submission.data)) {
    const field = index.get(fid)?.field;
    if (field?.type !== "signature" || !v || typeof v !== "object") continue;
    const ref = v as { fileId?: string; sha256?: string; signedAt?: string };
    let image: Buffer | null = null;
    if (ref.fileId) {
      const file = await db.query.files.findFirst({ where: and(eq(schema.files.id, ref.fileId), eq(schema.files.workspaceId, workspaceId), eq(schema.files.submissionId, submission.id)) });
      if (file) image = await getObject(file.storageKey).catch(() => null);
    }
    signatures.push({ key: field.key, label: field.label || "Unterschrift", image, signedAt: ref.signedAt ? berlin(new Date(ref.signedAt)) : "–", hash: ref.sha256 ?? "–" });
  }
  const model = buildModel({
    workspaceName: await workspaceName(workspaceId),
    definition,
    data: submission.data,
    number: submission.number,
    submittedAt: submission.submittedAt,
    version: version.number,
    status: STATUS_LABELS[submission.status],
    id: submission.id,
    signatures,
    templateBody: await templateFor(workspaceId, submission.formId, opts),
  });
  const buffer = await renderToBuffer(<SubmissionDocument m={model} />);
  return { buffer: Buffer.from(buffer), filename: `${safeName(definition.title)}-antwort-${submission.number}.pdf` };
}

/** Beispieldaten für die Vorlagen-Vorschau, wenn es noch keine Antwort gibt. */
function sampleValue(f: Field): unknown {
  switch (f.type) {
    case "email": return "erika.musterfrau@beispiel.de";
    case "phone": return "+49 2273 123456";
    case "number": case "slider": return 42;
    case "currency": return 1250.5;
    case "rating": return Math.min(4, f.ratingMax ?? 5);
    case "date": return "2026-10-22";
    case "time": return "14:30";
    case "datetime": return "2026-10-22T14:30";
    case "date_range": return { start: "2026-11-02", end: "2026-11-06" };
    case "yes_no": return true;
    case "consent": return true;
    case "dropdown": case "single_choice": return f.options?.[0]?.value;
    case "multi_select": case "checkboxes": return f.options?.slice(0, 2).map((o) => o.value);
    case "name": return { first: "Erika", last: "Musterfrau" };
    case "address": return { street: "Musterstraße 1", postalCode: "50667", city: "Köln", country: "Deutschland" };
    case "file": return [{ id: "beispiel00", name: "Beispiel.pdf", size: 182_000, type: "application/pdf" }];
    case "matrix": return Object.fromEntries((f.matrix?.rows ?? []).map((r) => [r.id, f.matrix!.multiple ? [f.matrix!.columns[0].value] : f.matrix!.columns[0].value]));
    case "signature": case "group": return undefined;
    default: return isInputField(f) ? `Beispiel: ${f.label || f.key}` : undefined;
  }
}

/** Vorschau einer (ungespeicherten) Vorlage: neueste Antwort, sonst Beispieldaten. */
export async function renderTemplatePreview(workspaceId: string, formId: string, templateBody: string) {
  const latest = await db.query.submissions.findFirst({ where: and(eq(schema.submissions.workspaceId, workspaceId), eq(schema.submissions.formId, formId)), orderBy: desc(schema.submissions.submittedAt), columns: { id: true } });
  if (latest) return (await renderSubmissionPdf(workspaceId, latest.id, { templateBody })).buffer;
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.id, formId), eq(schema.forms.workspaceId, workspaceId)) });
  if (!form) throw new NotFound();
  const def = form.draft;
  const data: Record<string, unknown> = {};
  for (const { field, parent } of fieldIndex(def).values()) {
    if (parent) continue;
    const v = sampleValue(field);
    if (v !== undefined) data[field.id] = v;
  }
  const model = buildModel({ workspaceName: await workspaceName(workspaceId), definition: def, data, number: 1, submittedAt: new Date(), version: 1, status: "Beispiel", id: "00000000-0000-0000-0000-000000000000", signatures: [], templateBody });
  return Buffer.from(await renderToBuffer(<SubmissionDocument m={model} />));
}

export { DEFAULT_TEMPLATE };
