"use client";
import { ArrowLeft, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormRenderer } from "@/components/form/renderer";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import type { FormDefinition } from "@/lib/forms/schema";
import type { TemplateIcon } from "@/lib/templates";
import { createFromTemplateAction } from "@/server/actions/templates";
import { DescribeDialog } from "./describe-dialog";
import { TEMPLATE_ICONS } from "./icons";

type Item = { id: string; name: string; description: string; category: string; icon: TemplateIcon; definition: FormDefinition };

const MODE = { classic: "Classic", cards: "Cards", wizard: "Wizard" } as const;

export function TemplateGallery({ items, canWrite }: { items: Item[]; canWrite: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(items[0].id);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [describe, setDescribe] = useState(false);
  const [pending, start] = useTransition();
  const current = items.find((i) => i.id === selected)!;

  const use = (id: string) =>
    start(async () => {
      const r = await createFromTemplateAction(id);
      if (!r.ok) return void toast.error(r.error);
      toast("Formular aus Vorlage angelegt");
      router.push(`/formulare/${r.data.id}/bearbeiten`);
    });

  const pages = current.definition.pages.length;
  const inputs = current.definition.pages.flatMap((p) => p.fields).filter((f) => !["heading", "paragraph", "divider", "image"].includes(f.type)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Vorlagen"
        description="Echte, sofort nutzbare Formulare – mit Logik, Berechnungen und Uploads. Alles bleibt frei bearbeitbar."
        actions={canWrite && <Button variant="secondary" onClick={() => setDescribe(true)}><Wand2 /> Aus Beschreibung erstellen</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul className={cn("space-y-1", mobilePreview && "max-lg:hidden")} aria-label="Vorlagen">
          {items.map((t) => {
            const Icon = TEMPLATE_ICONS[t.icon];
            const active = t.id === selected;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-current={active || undefined}
                  onClick={() => {
                    setSelected(t.id);
                    setMobilePreview(true);
                  }}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors", active ? "bg-paper shadow-sheet" : "hover:bg-desk-2")}
                >
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4", active ? "bg-stamp-soft text-stamp" : "bg-desk-2 text-muted")}>
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-medium">{t.name}</span>
                      <span className="text-[11.5px] text-faint">{t.category}</span>
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section aria-label={`Vorschau: ${current.name}`} className={cn("min-w-0 lg:sticky lg:top-6 lg:self-start", !mobilePreview && "max-lg:hidden")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobilePreview(false)}><ArrowLeft /> Alle Vorlagen</Button>
              <span className="text-[12.5px] text-muted">
                {MODE[current.definition.settings.mode]} · {inputs} Fragen{pages > 1 ? ` · ${pages} Schritte` : ""}{current.definition.rules.length ? ` · ${current.definition.rules.length} Regeln` : ""}
              </span>
            </div>
            {canWrite && <Button variant="primary" loading={pending} onClick={() => use(current.id)}>Vorlage verwenden</Button>}
          </div>
          <div className="rounded-lg bg-paper px-5 py-8 shadow-sheet sm:px-10 sm:py-10 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <p className="mb-6 inline-block rounded-full bg-desk px-2.5 py-0.5 text-[11.5px] text-muted">Vorschau – zum Ausprobieren, es wird nichts gespeichert</p>
            <FormRenderer key={current.id} definition={current.definition} preview />
          </div>
        </section>
      </div>
      <DescribeDialog open={describe} onOpenChange={setDescribe} />
    </div>
  );
}
