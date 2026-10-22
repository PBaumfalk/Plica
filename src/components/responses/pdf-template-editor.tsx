"use client";
import { Check, FileText, Loader2, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { deletePdfTemplateAction, savePdfTemplateAction } from "@/server/actions/submissions";

type T = { id: string; name: string; body: string; isDefault: boolean };

const SNIPPETS = [
  { label: "Alle Antworten", text: "{{antworten}}" },
  { label: "Antwortnummer", text: "{{nummer}}" },
  { label: "Eingangsdatum", text: "{{eingang}}" },
  { label: "Heutiges Datum", text: "{{datum}}" },
  { label: "Formulartitel", text: "{{formular}}" },
];

export function PdfTemplateEditor({ formId, templates, fields, defaultBody, canEdit, previewSource }: { formId: string; templates: T[]; fields: { key: string; label: string; type: string }[]; defaultBody: string; canEdit: boolean; previewSource: "latest" | "sample" }) {
  const router = useRouter();
  const [current, setCurrent] = useState<T>(() => templates.find((t) => t.isDefault) ?? templates[0] ?? { id: "", name: "Standard", body: defaultBody, isDefault: true });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<{ url: string | null; loading: boolean; error: string | null }>({ url: null, loading: true, error: null });
  const [confirm, setConfirm] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastUrl = useRef<string | null>(null);

  const refresh = useCallback(async (body: string) => {
    setPreview((p) => ({ ...p, loading: true, error: null }));
    try {
      const r = await fetch(`/api/forms/${formId}/pdf-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message ?? "Die Vorschau konnte nicht erzeugt werden.");
      const url = URL.createObjectURL(await r.blob());
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = url;
      setPreview({ url, loading: false, error: null });
    } catch (e) {
      setPreview((p) => ({ ...p, loading: false, error: e instanceof Error ? e.message : "Fehler" }));
    }
  }, [formId]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(current.body), 700);
    return () => clearTimeout(timer.current);
  }, [current.body, refresh]);

  useEffect(() => () => {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
  }, []);

  const edit = (patch: Partial<T>) => {
    setCurrent((c) => ({ ...c, ...patch }));
    setDirty(true);
  };

  const insert = (text: string) => {
    const el = area.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const block = text === "{{antworten}}" || text.startsWith("{{unterschrift:");
    const value = current.body.slice(0, s) + (block ? `\n${text}\n` : text) + current.body.slice(e);
    edit({ body: value });
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + text.length + (block ? 2 : 0);
      el.setSelectionRange(pos, pos);
    });
  };

  const save = () =>
    start(async () => {
      const r = await savePdfTemplateAction(formId, { id: current.id || undefined, name: current.name, body: current.body, isDefault: current.isDefault });
      if (!r.ok) return void toast.error(r.error);
      setCurrent((c) => ({ ...c, id: r.data.id }));
      setDirty(false);
      toast("PDF-Vorlage gespeichert");
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => (setCurrent(t), setDirty(false))}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]", t.id === current.id ? "border-stamp-line bg-stamp-soft font-medium text-stamp" : "border-line bg-paper text-ink-2 hover:border-line-strong")}
            >
              {t.isDefault && <Star className="size-3 fill-current" />}
              {t.name}
            </button>
          ))}
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => (setCurrent({ id: "", name: "Neue Vorlage", body: defaultBody, isDefault: templates.length === 0 }), setDirty(true))}>
              <Plus /> Neue Vorlage
            </Button>
          )}
        </div>
        <div className="rounded-lg bg-paper p-4 shadow-sheet">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Input aria-label="Name der Vorlage" value={current.name} onChange={(e) => edit({ name: e.target.value })} disabled={!canEdit} className="h-8 max-w-56" />
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <Switch checked={current.isDefault} onCheckedChange={(v) => edit({ isDefault: v })} disabled={!canEdit} label="Als Standard verwenden" />
              Standard für PDFs
            </label>
          </div>
          <textarea
            ref={area}
            value={current.body}
            onChange={(e) => edit({ body: e.target.value })}
            readOnly={!canEdit}
            spellCheck
            aria-label="Vorlagentext"
            className="h-[420px] w-full resize-y rounded-md border border-line-strong bg-paper-2 p-3 font-mono text-[13px] leading-relaxed focus:border-stamp focus:outline-none focus:ring-3 focus:ring-stamp/15"
          />
          {(() => {
            // Unbekannte Platzhalter blieben im PDF leer – vorher sagen
            const known = new Set(["antworten", "nummer", "eingang", "datum", "formular", ...fields.map((f) => f.key)]);
            const unknown = [...new Set([...current.body.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !known.has(k.startsWith("unterschrift:") ? k.slice(13) : k) && !(k.startsWith("unterschrift:") && fields.some((f) => f.key === k.slice(13)))))];
            return unknown.length > 0 ? (
              <p role="status" className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
                Unbekannte Platzhalter bleiben im PDF leer: {unknown.map((k) => `{{${k}}}`).join(", ")}
              </p>
            ) : null;
          })()}
          {canEdit && (
            <div className="mt-3 space-y-2">
              <div className="text-[12px] font-medium text-muted">Einfügen</div>
              <div className="flex flex-wrap gap-1">
                {SNIPPETS.map((s) => (
                  <button key={s.text} onClick={() => insert(s.text)} className="rounded-xs border border-line bg-paper px-1.5 py-0.5 text-[12px] hover:border-stamp hover:text-stamp">{s.label}</button>
                ))}
              </div>
              {fields.length > 0 && (
                <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                  {fields.map((f) => (
                    <button key={f.key} onClick={() => insert(f.type === "signature" ? `{{unterschrift:${f.key}}}` : `{{${f.key}}}`)} title={f.type === "signature" ? `{{unterschrift:${f.key}}}` : `{{${f.key}}}`} className="rounded-xs bg-desk-2 px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-stamp-soft hover:text-stamp">
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[12px] leading-relaxed text-muted">
                <code className="font-mono"># Überschrift</code>, <code className="font-mono">**fett**</code>, <code className="font-mono">- Aufzählung</code>, <code className="font-mono">---</code> Linie. Antworten werden wörtlich eingesetzt, sie können die Formatierung nicht verändern.
              </p>
            </div>
          )}
          {canEdit && (
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              {current.id ? (
                <Button size="sm" variant="ghost" className="text-bad" onClick={() => setConfirm(true)}><Trash2 /> Löschen</Button>
              ) : <span />}
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-muted">{dirty ? "Nicht gespeichert" : current.id ? <><Check className="inline size-3.5" /> Gespeichert</> : ""}</span>
                <Button variant="primary" size="sm" loading={pending} disabled={!dirty} onClick={save}>Vorlage speichern</Button>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="min-w-0" aria-label="Vorschau">
        <div className="mb-2 flex items-center justify-between text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" /> Vorschau mit {previewSource === "latest" ? "der neuesten Antwort" : "Beispieldaten"}</span>
          <button onClick={() => void refresh(current.body)} className="inline-flex items-center gap-1 hover:text-ink"><RefreshCw className={cn("size-3.5", preview.loading && "animate-spin")} /> Aktualisieren</button>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-desk-2 p-2 shadow-sheet">
          {preview.error ? (
            <p className="flex h-[640px] items-center justify-center px-6 text-center text-[13.5px] text-bad">{preview.error}</p>
          ) : preview.url ? (
            <iframe src={preview.url} title="PDF-Vorschau" className={cn("h-[640px] w-full rounded-md bg-white transition-opacity", preview.loading && "opacity-60")} />
          ) : (
            <div className="flex h-[640px] items-center justify-center gap-2 text-[13.5px] text-muted"><Loader2 className="size-4 animate-spin" /> Vorschau wird erzeugt …</div>
          )}
        </div>
      </section>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Vorlage löschen?" description={`„${current.name}“ wird entfernt. PDFs nutzen danach ${templates.length > 1 ? "eine andere Standardvorlage oder " : ""}das eingebaute Layout.`}>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={() =>
                start(async () => {
                  setConfirm(false);
                  const r = await deletePdfTemplateAction(formId, current.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast("Vorlage gelöscht");
                  setCurrent({ id: "", name: "Standard", body: defaultBody, isDefault: true });
                  setDirty(false);
                  router.refresh();
                })
              }
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
