import "server-only";
import { formatValue } from "@/lib/forms/format";
import { isInputField, type Field } from "@/lib/forms/schema";
import { NotFound } from "@/server/forms/service";
import { STATUS_LABELS } from "@/server/submissions/labels";
import { neighbours, submissionDetail, type ListQuery } from "@/server/submissions/service";
import type { DetailData, DetailFile, DetailItem, Status } from "@/components/responses/types";

function fmtSize(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export async function loadDetail(workspaceId: string, userId: string, formId: string, sid: string, q: ListQuery): Promise<DetailData> {
  const d = await submissionDetail(workspaceId, sid);
  const { submission: s, definition: def, version } = d;
  if (s.formId !== formId) throw new NotFound("Antwort");
  const filesById = new Map(d.files.map((f) => [f.id, f]));
  const toFile = (id: string): DetailFile | null => {
    const f = filesById.get(id);
    if (!f) return null;
    return { id: f.id, name: f.name, mime: f.mime, size: f.size, status: f.status, released: !!(f.meta as { releasedAt?: string }).releasedAt, scanNote: f.scanNote };
  };

  const item = (field: Field, value: unknown): DetailItem | null => {
    if (value === undefined || value === null || value === "") return null;
    const base = { fieldId: field.id, label: field.label || field.key, type: field.type, text: "" };
    if (field.type === "file") return { ...base, files: (Array.isArray(value) ? value : []).map((r) => toFile((r as { id: string }).id)).filter((x): x is DetailFile => !!x) };
    if (field.type === "signature") {
      const v = value as { fileId?: string; signedAt?: string; sha256?: string };
      const file = v.fileId ? filesById.get(v.fileId) : undefined;
      const meta = (file?.meta ?? {}) as { ipHash?: string; userAgent?: string };
      return { ...base, signature: v.fileId ? { fileId: v.fileId, signedAt: v.signedAt ?? null, hash: v.sha256 ?? "", ipHash: meta.ipHash, userAgent: meta.userAgent } : null };
    }
    if (field.type === "group" && Array.isArray(value)) {
      return {
        ...base,
        group: value.map((it, i) => ({
          title: `${field.itemLabel ?? "Eintrag"} ${i + 1}`,
          rows: (field.fields ?? []).filter(isInputField).map((c) => ({ label: c.label || c.key, value: formatValue(c, (it as Record<string, unknown>)[c.id]) })).filter((r) => r.value),
        })),
      };
    }
    if (field.type === "matrix") {
      const o = value as Record<string, string | string[]>;
      const cols = new Map((field.matrix?.columns ?? []).map((c) => [c.value, c.label]));
      return { ...base, lines: (field.matrix?.rows ?? []).filter((r) => o[r.id]).map((r) => `${r.label}: ${[o[r.id]].flat().map((c) => cols.get(c) ?? c).join(", ")}`) };
    }
    return { ...base, text: formatValue(field, value) };
  };

  const sections = def.pages
    .map((p) => ({ title: def.pages.length > 1 ? p.title : "", items: p.fields.filter(isInputField).map((f) => item(f, s.data[f.id])).filter((x): x is DetailItem => !!x) }))
    .filter((x) => x.items.length);

  const timeline: DetailData["timeline"] = [];
  for (const e of d.events) {
    const data = e.data as Record<string, unknown>;
    let text = e.type;
    if (e.type === "created") text = `Eingegangen über das Formular (Version ${data.version ?? version.number})`;
    else if (e.type === "status" || e.type === "status_changed") text = `Status: ${STATUS_LABELS[data.from as Status] ?? data.from} → ${STATUS_LABELS[data.to as Status] ?? data.to}`;
    else if (e.type === "tags") {
      const parts = [...((data.added as string[]) ?? []).map((t) => `+${t}`), ...((data.removed as string[]) ?? []).map((t) => `−${t}`)];
      text = parts.length ? `Tags ${parts.join(" ")}` : "Tags geändert";
    }
    else if (e.type === "tags_changed") text = `Tags über die API gesetzt: ${((data.tags as string[]) ?? []).join(", ") || "keine"}`;
    else if (e.type === "approval_approved") text = `Freigabe „${data.title}“ erteilt${data.comment ? `: ${data.comment}` : ""}`;
    else if (e.type === "approval_rejected") text = `Freigabe „${data.title}“ abgelehnt${data.comment ? `: ${data.comment}` : ""}`;
    else if (e.type === "starred") text = "Markiert";
    else if (e.type === "unstarred") text = "Markierung entfernt";
    else if (e.type === "note_added") text = `Notiz: „${String(data.preview ?? "")}${String(data.preview ?? "").length >= 80 ? "…" : ""}“`;
    else if (e.type === "note_deleted") text = "Notiz gelöscht";
    else if (e.type === "file_released") text = `Datei „${data.file}“ ohne Virenprüfung freigegeben`;
    else if (e.type === "pdf_generated") text = "PDF erzeugt";
    timeline.push({ id: `e${e.id}`, at: e.createdAt.toISOString(), who: e.user, text, kind: "event" });
  }
  for (const r of d.runs) {
    const label = r.status === "succeeded" ? "erfolgreich" : r.status === "failed" ? "fehlgeschlagen" : r.status === "partial" ? "teilweise erfolgreich" : "läuft";
    timeline.push({ id: `r${r.id}`, at: r.createdAt.toISOString(), who: null, text: `${String(r.trigger).startsWith("test:") ? "Testlauf: " : ""}Automation „${r.name}“ ${label}`, kind: "run", tone: r.status === "succeeded" ? "ok" : r.status === "failed" ? "bad" : undefined });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  const nb = await neighbours(workspaceId, formId, q, s.id);
  const ending = def.endings.find((e) => e.id === s.endingId);
  return {
    id: s.id,
    number: s.number,
    status: s.status,
    tags: s.tags,
    starred: s.starred,
    submittedAt: s.submittedAt.toISOString(),
    version: version.number,
    meta: s.meta,
    email: s.respondentEmail,
    deleteAfter: s.deleteAfter?.toISOString() ?? null,
    endingTitle: def.endings.length > 1 ? (ending?.title ?? null) : null,
    sections,
    notes: d.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), user: n.user, mine: n.userId === userId })),
    timeline,
    // Von Automationen erzeugte Dokumente (z. B. PDF-Schritt)
    documents: d.files.filter((f) => f.kind === "pdf").map((f) => toFile(f.id)!).filter(Boolean),
    prev: nb.prev,
    next: nb.next,
  };
}

export { fmtSize };
