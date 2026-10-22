"use client";
import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { TimeAgo } from "@/components/ui/time-ago";
import { dateTime } from "@/lib/time";
import { purgeFormAction, restoreFormAction } from "@/server/actions/forms";

export type TrashRow = { id: string; title: string; deletedAt: string; purgeAt: string; submissions: number };

/** Papierkorb: gelöschte Formulare 30 Tage zurückholen oder vorher endgültig löschen. */
export function TrashList({ items }: { items: TrashRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [purge, setPurge] = useState<TrashRow | null>(null);
  const [confirm, setConfirm] = useState("");

  if (!items.length)
    return (
      <div className="rounded-lg border border-dashed border-line-strong bg-paper/50">
        <Empty icon={<Trash2 />} title="Der Papierkorb ist leer">Gelöschte Formulare liegen hier 30 Tage, bevor sie mit allen Antworten endgültig entfernt werden.</Empty>
      </div>
    );

  return (
    <>
      <p className="mb-3 text-[13px] text-muted">Formulare werden 30 Tage nach dem Löschen mit allen Antworten und Dateien endgültig entfernt.</p>
      <ul className="overflow-hidden rounded-lg bg-paper shadow-sheet">
        {items.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[17px] font-[480]">{f.title || "Unbenanntes Formular"}</div>
              <div className="mt-0.5 text-[12.5px] text-muted">
                gelöscht <TimeAgo at={f.deletedAt} /> · {f.submissions} {f.submissions === 1 ? "Antwort" : "Antworten"} · endgültig am <span title={dateTime(f.purgeAt)}>{new Date(f.purgeAt).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}</span>
              </div>
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await restoreFormAction(f.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast(`„${f.title}“ wiederhergestellt – im vorherigen Zustand, Adresse /f/${r.data.slug}`);
                  router.refresh();
                })
              }
            >
              <RotateCcw /> Wiederherstellen
            </Button>
            <Button size="sm" variant="ghost" className="text-bad" disabled={pending} onClick={() => (setConfirm(""), setPurge(f))}>
              <Trash2 /> Endgültig löschen
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!purge} onOpenChange={(o) => !o && setPurge(null)}>
        {purge && (
          <DialogContent title="Endgültig löschen?" description={`„${purge.title}“ wird mit ${purge.submissions} ${purge.submissions === 1 ? "Antwort" : "Antworten"} und allen Dateien sofort und unwiderruflich gelöscht.`}>
            <label htmlFor="purge-confirm" className="mb-1.5 block text-[13px] text-ink-2">Zur Bestätigung den Titel eingeben: <span className="font-medium">{purge.title || "Unbenanntes Formular"}</span></label>
            <Input id="purge-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setPurge(null)}>Abbrechen</Button>
              <Button
                variant="danger"
                loading={pending}
                disabled={confirm.trim() !== (purge.title || "Unbenanntes Formular").trim()}
                onClick={() =>
                  start(async () => {
                    const r = await purgeFormAction(purge.id, confirm);
                    if (!r.ok) return void toast.error(r.error);
                    toast("Endgültig gelöscht");
                    setPurge(null);
                    router.refresh();
                  })
                }
              >
                Endgültig löschen
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
