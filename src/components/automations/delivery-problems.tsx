"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimeAgo } from "@/components/ui/time-ago";
import { retryJobAction } from "@/server/actions/jobs";
import { retryRunAction } from "@/server/actions/workflows";

export type ProblemRow = { id: number; runId?: string; label: string; formId: string; formTitle: string; submissionNumber: number; lastError: string | null; finishedAt: string | null };

/** Endgültig gescheiterte Zustellungen – mit „Erneut versuchen“. */
export function DeliveryProblems({ items, canRetry, showForm }: { items: ProblemRow[]; canRetry: boolean; showForm?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!items.length) return null;
  return (
    <section role="alert" className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-bad-soft p-4">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-bad">
        <AlertTriangle className="size-4" /> {items.length === 1 ? "Eine Zustellung oder Automation ist fehlgeschlagen" : `${items.length} Zustellungen oder Automationen sind fehlgeschlagen`}
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">Vorübergehende Fehler wiederholt PLICA automatisch über mehrere Stunden; endgültige Ablehnungen (z. B. ein Webhook-Ziel antwortet 400) nicht. Prüfe die Ursache (E-Mail-Server, Webhook-Ziel) und stoße es erneut an. Achtung: Eine fehlgeschlagene Automation läuft dabei komplett neu – auch Schritte, die schon erledigt waren (z. B. Bestätigungsmails).</p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md bg-paper">
        {items.slice(0, 10).map((p) => (
          <li key={p.runId ?? p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {p.label} · Antwort #{p.submissionNumber}
                {showForm && (
                  <>
                    {" "}· <Link className="text-stamp hover:underline" href={`/formulare/${p.formId}/automationen`}>{p.formTitle}</Link>
                  </>
                )}
              </div>
              <div className="truncate text-[12.5px] text-muted">
                {p.lastError ?? (p.runId ? "Ein Schritt ist fehlgeschlagen – Details im Protokoll der Automation" : "Unbekannter Fehler")}
                {p.finishedAt && <> · <TimeAgo at={p.finishedAt} /></>}
              </div>
            </div>
            {canRetry && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = p.runId ? await retryRunAction(p.runId) : await retryJobAction(p.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast("Wird erneut versucht");
                    router.refresh();
                  })
                }
              >
                <RotateCcw /> Erneut versuchen
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
