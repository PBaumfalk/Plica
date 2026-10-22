"use client";
/** Formular aus einer Beschreibung erzeugen – Vorschau vor dem Anlegen. */
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormRenderer } from "@/components/form/renderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { FIELD_META } from "@/lib/forms/fields";
import { fieldIndex, type FormDefinition } from "@/lib/forms/schema";
import { createFormAction } from "@/server/actions/forms";
import { generateFromDescriptionAction } from "@/server/actions/templates";

const EXAMPLES = [
  "Anmeldung für Sommerfest mit Name, E-Mail, Anzahl Personen, vegetarisch ja/nein, Datenschutz",
  "Rückrufbitte: Name, Telefon, Anliegen (Erstberatung, laufende Sache, Rechnung), bester Zeitpunkt, Nachricht",
  "Mehrstufige Bewerbung mit Name, E-Mail, Telefon, Adresse, Eintrittsdatum, Gehaltsvorstellung, Lebenslauf hochladen, Zeugnisse, Motivation, Datenschutz",
];

export function DescribeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ definition: FormDefinition; source: "ai" | "builtin"; note?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGen] = useTransition();
  const [creating, startCreate] = useTransition();

  const generate = () =>
    startGen(async () => {
      setError(null);
      const r = await generateFromDescriptionAction(text);
      if (!r.ok) return setError(r.error);
      setResult(r.data);
    });

  const fields = result ? [...fieldIndex(result.definition).values()].filter((e) => !e.parent).map((e) => e.field) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(() => (setResult(null), setError(null)), 200);
      }}
    >
      <DialogContent wide title={result ? "Entwurf prüfen" : "Formular beschreiben"} description={result ? "So sieht das Formular aus. Alles lässt sich danach im Editor ändern." : "Nenne Zweck und Felder in einem Satz. PLICA erkennt Feldtypen, Pflichtangaben und Auswahlmöglichkeiten."} className="max-w-3xl">
        {!result ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <label htmlFor="describe" className="sr-only">Beschreibung</label>
            <Textarea
              id="describe"
              autoFocus
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
              }}
              placeholder="z. B. Anmeldung für Sommerfest mit Name, E-Mail, Anzahl Personen, Essen (Fleisch, Fisch, Vegan), Datenschutz"
              aria-invalid={!!error}
            />
            <div className="space-y-1.5">
              <div className="text-[12px] font-medium text-muted">Beispiele</div>
              <div className="flex flex-col gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-2 hover:bg-desk-2">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
            {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-faint">⌘ + Enter</span>
              <Button type="submit" variant="primary" loading={generating} disabled={text.trim().length < 3}>
                <Wand2 /> Entwurf erzeugen
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              <Sparkles className="size-3.5" />
              {result.source === "ai" ? "Erzeugt mit der konfigurierten KI." : "Erzeugt mit dem eingebauten Generator – ohne KI, direkt auf diesem Server."}
              <span>· {fields.length} Felder</span>
            </div>
            {result.note && <p className="rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">{result.note}</p>}
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <span key={f.id} className="inline-flex h-6 items-center gap-1 rounded-xs bg-desk-2 px-2 text-[12px]">
                  <span className="text-ink">{f.label || FIELD_META[f.type].label}</span>
                  <span className="text-faint">{FIELD_META[f.type].label}</span>
                </span>
              ))}
            </div>
            <div className="max-h-[46vh] overflow-y-auto rounded-md border border-line bg-paper px-5 py-6 sm:px-8">
              <FormRenderer definition={result.definition} preview />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={() => setResult(null)}><ArrowLeft /> Beschreibung ändern</Button>
              <Button
                variant="primary"
                loading={creating}
                onClick={() =>
                  startCreate(async () => {
                    const r = await createFormAction({ definition: result.definition });
                    if (!r.ok) return void toast.error(r.error);
                    toast("Formular angelegt");
                    router.push(`/formulare/${r.data.id}/bearbeiten`);
                  })
                }
              >
                Formular anlegen und bearbeiten
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
