"use client";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCreateForm } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import type { TemplateIcon } from "@/lib/templates";
import { createFromTemplateAction, createSampleCollectionAction } from "@/server/actions/templates";
import { TEMPLATE_ICONS } from "./icons";

const STEPS = [
  { title: "Bauen", text: "Felder per Drag-and-drop oder mit „/“ einfügen. Regeln zeigen nur, was wirklich gefragt ist. Du siehst jederzeit das fertige Formular." },
  { title: "Teilen", text: "Veröffentlichen, Link oder QR-Code verschicken oder auf der Website einbetten. Änderungen bleiben Entwurf, bis du sie freigibst." },
  { title: "Bearbeiten", text: "Antworten prüfen, kommentieren, als PDF ablegen und exportieren. Automationen schicken Bestätigungen und informieren dein Team." },
];

export function Welcome({ name, workspace, canWrite, templates }: { name: string; workspace: string; canWrite: boolean; templates: { id: string; name: string; icon: TemplateIcon }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);
  const { create, pending: creating } = useCreateForm();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-20">
      <div className="animate-rise">
        <p className="text-[13px] font-medium text-stamp">{workspace} ist eingerichtet</p>
        <h1 className="mt-3 font-display text-[clamp(34px,6vw,52px)] leading-[1.05] font-[420] tracking-[-0.02em]">Willkommen, {name}.</h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted">
          PLICA ist dein Ort für Formulare: vom ersten Feld bis zur abgelegten Antwort. Alles läuft auf deinem Server – ohne Cloud-Konto, ohne Tracking.
        </p>
      </div>

      <ol className="mt-12 overflow-hidden rounded-lg bg-paper shadow-sheet">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 px-5 py-5 sm:px-7" style={{ animationDelay: `${120 + i * 80}ms` }}>
            {i > 0 && <div className="plica-crease absolute inset-x-0 top-0 -translate-y-1/2" aria-hidden />}
            <span className="grid size-8 place-items-center rounded-full bg-stamp-soft font-display text-[16px] text-stamp">{i + 1}</span>
            <div>
              <h2 className="text-[15px] font-semibold">{s.title}</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {canWrite ? (
        <section className="mt-12">
          <h2 className="text-[15px] font-semibold">Womit möchtest du anfangen?</h2>
          <p className="mt-1 text-[14px] text-muted">Wähle eine Vorlage – sie öffnet sich direkt im Editor und bleibt Entwurf, bis du sie veröffentlichst.</p>
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Vorlagen">
            {templates.map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!!opening}
                    onClick={() =>
                      start(async () => {
                        setOpening(t.id);
                        const r = await createFromTemplateAction(t.id);
                        if (!r.ok) {
                          setOpening(null);
                          return void toast.error(r.error);
                        }
                        router.push(`/formulare/${r.data.id}/bearbeiten`);
                      })
                    }
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-[13px] text-ink-2 transition-colors hover:border-stamp hover:text-stamp disabled:opacity-60 [&_svg]:size-3.5 [&_svg]:text-muted hover:[&_svg]:text-stamp"
                  >
                    <Icon /> {t.name}
                    {opening === t.id && <span className="sr-only"> wird angelegt</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild variant="primary" size="lg">
              <Link href="/vorlagen">Alle Vorlagen mit Vorschau <ArrowRight /></Link>
            </Button>
            <Button size="lg" loading={creating} onClick={() => create()}>
              <Plus /> Leeres Formular
            </Button>
            <Button
              size="lg"
              variant="ghost"
              loading={pending && !opening}
              onClick={() =>
                start(async () => {
                  const r = await createSampleCollectionAction();
                  if (!r.ok) return void toast.error(r.error);
                  toast(`${r.data.count} Beispielformulare als Entwürfe angelegt`);
                  router.push("/");
                })
              }
            >
              Alle zehn als Beispiele anlegen
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-12">
          <Button asChild variant="primary" size="lg"><Link href="/">Zu den Formularen <ArrowRight /></Link></Button>
        </div>
      )}
      <p className="mt-10 text-[13px] text-faint">
        Tipp: Mit <kbd className="rounded-xs border border-line bg-paper px-1 font-mono text-[11px]">⌘K</kbd> erreichst du jede Funktion über die Tastatur.
      </p>
    </div>
  );
}
