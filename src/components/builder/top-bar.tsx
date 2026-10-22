"use client";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, CloudOff, Eye, History, Inbox, Loader2, Monitor, Plus, Redo2, Rocket, Share2, SlidersHorizontal, Smartphone, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Popover, PopoverContent, PopoverTrigger, Tip } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import { canon } from "./builder";
import { useBuilder } from "./context";
import { selectedFieldIds } from "./store";

export function TopBar() {
  const b = useBuilder();
  const { state, api, save } = b;
  const s = state.def.settings;
  const dirtyVsPublished = b.publishedJson !== null && b.publishedJson !== canon(state.def);

  return (
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-desk px-2 sm:px-3">
      <Tip label="Zurück zu den Formularen">
        <Button asChild size="icon" variant="ghost" aria-label="Zurück zu den Formularen">
          <Link href="/"><ArrowLeft /></Link>
        </Button>
      </Tip>
      <input
        value={state.def.title}
        onChange={(e) => api.mutate((d) => void (d.title = e.target.value), "title")}
        aria-label="Titel des Formulars"
        placeholder="Unbenanntes Formular"
        className="h-8 min-w-0 flex-1 truncate md:w-[clamp(120px,22vw,300px)] md:flex-none rounded-md bg-transparent px-2 font-display text-[16.5px] font-[480] outline-none placeholder:text-faint hover:bg-desk-2 focus:bg-paper focus:ring-2 focus:ring-stamp/20"
      />
      <SaveIndicator status={save.status} error={save.error} />

      <div className="mx-auto hidden items-center gap-2 md:flex">
        <Segmented label="Darstellungsmodus" size="sm" value={s.mode} onChange={(m) => api.mutate((d) => void (d.settings.mode = m))} options={[{ value: "classic", label: "Classic", title: "Alle Fragen untereinander" }, { value: "cards", label: "Cards", title: "Eine Frage pro Bildschirm" }, { value: "wizard", label: "Wizard", title: "Schritte mit Fortschritt" }]} />
        <Segmented label="Gerät" size="sm" value={b.device} onChange={b.setDevice} options={[{ value: "desktop", label: <Monitor />, title: "Desktop" }, { value: "mobile", label: <Smartphone />, title: "Smartphone" }]} />
      </div>

      <div className="flex shrink-0 items-center gap-1 md:ml-0">
        <Tip label="Rückgängig" shortcut="⌘Z">
          <Button size="icon" variant="ghost" aria-label="Rückgängig" disabled={!state.past.length} onClick={api.undo}><Undo2 /></Button>
        </Tip>
        <Tip label="Wiederholen" shortcut="⌘⇧Z">
          <Button size="icon" variant="ghost" aria-label="Wiederholen" disabled={!state.future.length} onClick={api.redo} className="max-sm:hidden"><Redo2 /></Button>
        </Tip>
        <Button size="icon" variant="ghost" aria-label="Feld einfügen" className="lg:hidden" onClick={() => b.openMobilePanel("palette")}><Plus /></Button>
        <Button size="icon" variant="ghost" aria-label="Eigenschaften" className="lg:hidden" onClick={() => b.openMobilePanel("inspector")} disabled={!selectedFieldIds(state.selection).length && state.selection?.kind !== "page" && b.panel === "field"}>
          <SlidersHorizontal />
        </Button>
        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Tip label="Teilen und Einstellungen">
          <Button asChild size="icon" variant="ghost" aria-label="Teilen" className="max-sm:hidden">
            <Link href={`/formulare/${b.formId}/teilen`}><Share2 /></Link>
          </Button>
        </Tip>
        <Tip label="Antworten">
          <Button asChild size="icon" variant="ghost" aria-label="Antworten" className="max-sm:hidden">
            <Link href={`/formulare/${b.formId}/antworten`}><Inbox /></Link>
          </Button>
        </Tip>
        <Tip label="Vorschau" shortcut="⌘⇧P">
          <Button size="sm" variant="secondary" onClick={b.openPreview} aria-label="Vorschau" className="max-sm:w-8 max-sm:justify-center max-sm:px-0">
            <Eye /> <span className="max-sm:hidden">Vorschau</span>
          </Button>
        </Tip>
        {b.canPublish && <PublishButton dirty={dirtyVsPublished} />}
      </div>
    </header>
  );
}

function SaveIndicator({ status, error }: { status: string; error: string | null }) {
  const map = {
    saved: { icon: <Check className="size-3.5" />, text: "Gespeichert", cls: "text-faint" },
    dirty: { icon: <span className="size-1.5 rounded-full bg-faint" />, text: "Ungespeichert", cls: "text-faint" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Speichert …", cls: "text-muted" },
    error: { icon: <CloudOff className="size-3.5" />, text: "Nicht gespeichert", cls: "text-bad" },
    conflict: { icon: <AlertTriangle className="size-3.5" />, text: "Konflikt", cls: "text-warn" },
  } as const;
  const m = map[status as keyof typeof map];
  return (
    <span role="status" aria-live="polite" title={error ?? undefined} className={cn("hidden items-center gap-1.5 whitespace-nowrap text-[12px] sm:inline-flex", m.cls)}>
      {m.icon} {m.text}
    </span>
  );
}

function PublishButton({ dirty }: { dirty: boolean }) {
  const b = useBuilder();
  const [open, setOpen] = useState(false);
  const never = b.publishedJson === null;
  const errors = b.issues.filter((i) => i.severity === "error").length;
  return (
    <div className="flex items-center">
      <Button variant="primary" size="sm" loading={b.publishing} disabled={!never && !dirty && b.status === "published"} onClick={() => void b.publish()} className="rounded-r-none disabled:opacity-100">
        {!b.publishing && (!never && !dirty && b.status === "published" ? <Check /> : <Rocket />)}
        <span className="max-sm:sr-only">{never ? "Veröffentlichen" : dirty ? "Änderungen veröffentlichen" : "Veröffentlicht"}</span>
        {dirty && <span className="size-1.5 rounded-full bg-current opacity-80" aria-label="ungespeicherte Änderungen" />}
        {errors > 0 && <span className="rounded-full bg-white/25 px-1.5 text-[11px]">{errors}</span>}
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="primary" size="sm" aria-label="Versionen" className="rounded-l-none border-l border-white/20 px-1.5"><ChevronDown /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b border-line px-3.5 py-3">
            <div className="text-[13px] font-semibold">{never ? "Noch nicht veröffentlicht" : dirty ? "Entwurf weicht von der veröffentlichten Version ab" : "Entwurf entspricht der veröffentlichten Version"}</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">Du bearbeitest immer einen Entwurf. Erst „Veröffentlichen“ ändert, was Ausfüllende sehen – bestehende Antworten bleiben ihrer Version zugeordnet.</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            <div className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11.5px] font-medium uppercase tracking-wider text-faint"><History className="size-3" /> Versionen</div>
            {b.versions.length === 0 && <p className="px-2 py-2 text-[12.5px] text-muted">Noch keine Version.</p>}
            {b.versions.map((v, i) => (
              <div key={v.id} className="group flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-desk-2">
                <span className="font-mono text-[12px] text-muted">v{v.number}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{relativeTime(v.publishedAt)}{v.publishedBy ? ` · ${v.publishedBy}` : ""}</div>
                  <div className="text-[11.5px] text-faint">{v.submissions} {v.submissions === 1 ? "Antwort" : "Antworten"}{i === 0 && b.status === "published" ? " · live" : ""}</div>
                </div>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => (setOpen(false), void b.restoreVersion(v.id))}>Wiederherstellen</Button>
              </div>
            ))}
          </div>
          {!never && (
            <div className="border-t border-line p-1.5">
              <a href={`/f/${b.slug}`} target="_blank" rel="noopener" className="flex h-8 items-center gap-2 rounded-sm px-2 text-[13px] hover:bg-desk-2">
                <Eye className="size-4 text-muted" /> Öffentliche Ansicht öffnen
              </a>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
