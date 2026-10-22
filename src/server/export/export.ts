/**
 * Exporte als CSV, XLSX oder JSON. Spalten = alle Felder über alle
 * Versionen; Zeilen = aktuelle Filter bzw. Auswahl.
 */
import "server-only";
import ExcelJS from "exceljs";
import type { FormDefinition } from "@/lib/forms/schema";
import type { SubmissionRow } from "../db/schema";
import { formVersions, iterateSubmissions, type ListQuery } from "../submissions/service";
import { STATUS_LABELS } from "../submissions/labels";
import { BOM, csvLine } from "./csv";
import { cellText, fieldFor, unionColumns, type Column } from "./columns";

export type ExportFormat = "csv" | "xlsx" | "json";

const META = ["Nummer", "Antwort-ID", "Eingang", "Status", "Version", "Tags", "Markiert"];

function berlin(d: Date) {
  return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });
}

function safeName(title: string) {
  return (title || "formular").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60).toLowerCase() || "formular";
}

async function context(workspaceId: string, formId: string) {
  const versions = await formVersions(formId);
  const byId = new Map(versions.map((v) => [v.id, v]));
  return { columns: unionColumns(versions), byId };
}

function metaCells(s: SubmissionRow, versionNumber: number | undefined) {
  return [String(s.number), s.id, berlin(s.submittedAt), STATUS_LABELS[s.status], versionNumber ? String(versionNumber) : "", s.tags.join(", "), s.starred ? "Ja" : ""];
}

export async function exportSubmissions(workspaceId: string, formId: string, formTitle: string, q: ListQuery, format: ExportFormat) {
  const { columns, byId } = await context(workspaceId, formId);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${safeName(formTitle)}-antworten-${stamp}`;
  let count = 0;

  if (format === "csv" || format === "json") {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (format === "csv") {
            controller.enqueue(enc.encode(BOM + csvLine([...META, ...columns.map((c) => c.label)])));
          } else controller.enqueue(enc.encode("[\n"));
          let first = true;
          for await (const batch of iterateSubmissions(workspaceId, formId, q)) {
            let chunk = "";
            for (const s of batch) {
              count++;
              const v = byId.get(s.versionId);
              const def = v?.definition as FormDefinition | undefined;
              if (format === "csv") {
                chunk += csvLine([...metaCells(s, v?.number), ...columns.map((c) => cellText(def, c, s.data))]);
              } else {
                const answers: Record<string, unknown> = {};
                for (const c of columns) if (s.data[c.fieldId] !== undefined) answers[c.key] = s.data[c.fieldId];
                chunk += `${first ? "" : ",\n"}${JSON.stringify({ id: s.id, number: s.number, submittedAt: s.submittedAt.toISOString(), status: s.status, version: v?.number ?? null, tags: s.tags, starred: s.starred, answers })}`;
                first = false;
              }
            }
            controller.enqueue(enc.encode(chunk));
          }
          if (format === "json") controller.enqueue(enc.encode("\n]\n"));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return {
      body: stream,
      filename: `${base}.${format}`,
      contentType: format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      count: () => count,
    };
  }

  // XLSX: typisierte Zellen, gestalteter Kopf
  const wb = new ExcelJS.Workbook();
  wb.creator = "PLICA";
  wb.created = new Date();
  const ws = wb.addWorksheet("Antworten", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [...META, ...columns.map((c) => c.label)].map((h, i) => ({ header: h, key: `c${i}`, width: i === 1 ? 38 : Math.min(Math.max(h.length + 4, 12), 40) }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FF1A1C21" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECEBFB" } };
  head.alignment = { vertical: "middle" };
  head.height = 22;

  for await (const batch of iterateSubmissions(workspaceId, formId, q)) {
    for (const s of batch) {
      count++;
      const v = byId.get(s.versionId);
      const def = v?.definition as FormDefinition | undefined;
      ws.addRow([s.number, s.id, s.submittedAt, STATUS_LABELS[s.status], v?.number ?? null, s.tags.join(", "), s.starred ? "Ja" : "", ...columns.map((c) => xlsxCell(def, c, s.data))]);
    }
  }
  ws.getColumn(3).numFmt = "dd.mm.yyyy hh:mm";
  columns.forEach((c, i) => {
    const col = ws.getColumn(META.length + 1 + i);
    if (c.field.type === "date") col.numFmt = "dd.mm.yyyy";
    if (c.field.type === "datetime") col.numFmt = "dd.mm.yyyy hh:mm";
    if (c.field.type === "currency") col.numFmt = '#,##0.00 "€"';
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: META.length + columns.length } };
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { body: buffer, filename: `${base}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", count: () => count };
}

function xlsxCell(def: FormDefinition | undefined, col: Column, data: Record<string, unknown>): string | number | Date | null {
  const v = data[col.fieldId];
  if (v === undefined || v === null || v === "") return null;
  const f = fieldFor(def, col);
  if ((f.type === "number" || f.type === "currency" || f.type === "rating" || f.type === "slider" || f.type === "calculated") && typeof v === "number") return v;
  if (f.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`);
  if (f.type === "datetime" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return new Date(`${v}:00Z`);
  const text = cellText(def, col, data);
  // Formeln in Textzellen gibt es in XLSX nicht – exceljs schreibt Strings als Text.
  return text;
}
