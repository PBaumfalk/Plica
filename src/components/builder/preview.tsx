"use client";
import { Dialog as D } from "radix-ui";
import { Monitor, RotateCcw, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { FormRenderer, type RenderMode } from "@/components/form/renderer";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { useBuilder } from "./context";

export function PreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state } = useBuilder();
  const [mode, setMode] = useState<RenderMode | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [run, setRun] = useState(0);
  const m = mode ?? state.def.settings.mode;
  return (
    <D.Root open={open} onOpenChange={(o) => (onOpenChange(o), o || setMode(null))}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_17_23/0.45)] data-[state=open]:animate-fade-in" />
        <D.Content aria-describedby={undefined} className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-lg bg-desk shadow-pop data-[state=open]:animate-pop-in sm:inset-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <D.Title className="mr-2 text-[14px] font-semibold">Vorschau</D.Title>
            <Segmented label="Modus" size="sm" value={m} onChange={(v) => (setMode(v), setRun((r) => r + 1))} options={[{ value: "classic", label: "Classic" }, { value: "cards", label: "Cards" }, { value: "wizard", label: "Wizard" }]} />
            <Segmented label="Gerät" size="sm" value={device} onChange={setDevice} options={[{ value: "desktop", label: <Monitor />, title: "Desktop" }, { value: "mobile", label: <Smartphone />, title: "Smartphone" }]} />
            <Button size="sm" variant="ghost" onClick={() => setRun((r) => r + 1)}><RotateCcw /> Neu starten</Button>
            <span className="ml-auto hidden text-[12.5px] text-muted sm:inline">Entwurf – nichts wird gespeichert oder versendet.</span>
            <D.Close className="rounded-sm p-1.5 text-muted hover:bg-desk-2 hover:text-ink" aria-label="Vorschau schließen"><X className="size-4" /></D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:py-10">
            <div className={cn("mx-auto bg-paper shadow-sheet transition-[max-width] duration-300", device === "mobile" ? "max-w-[410px] rounded-[28px] border-[10px] border-ink/90 px-5 py-8" : "max-w-[720px] rounded-lg px-6 py-10 sm:px-12 sm:py-14")}>
              <FormRenderer key={`${m}-${run}`} definition={state.def} mode={m} preview />
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
