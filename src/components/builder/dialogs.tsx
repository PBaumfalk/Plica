"use client";
import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/share/copy-field";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, Kbd } from "@/components/ui/overlays";
import { useBuilder } from "./context";

const SHORTCUTS: [string, string][] = [
  ["/", "Feld einfügen"],
  ["↑ ↓", "Vorheriges / nächstes Feld auswählen"],
  ["⌥↑ ⌥↓", "Ausgewähltes Feld verschieben"],
  ["Enter", "Frage des ausgewählten Feldes bearbeiten"],
  ["⇧ Klick", "Mehrere Felder auswählen"],
  ["⌘D", "Duplizieren"],
  ["⌘G", "In Wiederholgruppe zusammenfassen"],
  ["⌫", "Löschen"],
  ["⌘Z / ⌘⇧Z", "Rückgängig / Wiederholen"],
  ["⌘S", "Sofort speichern"],
  ["⌘⇧P", "Vorschau"],
  ["⌘K", "Befehle und Suche"],
  ["Esc", "Auswahl aufheben"],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Tastaturkürzel" description="Der Editor lässt sich vollständig mit der Tastatur bedienen.">
        <dl className="divide-y divide-line">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between py-2 text-[13.5px]">
              <dt className="text-ink-2">{label}</dt>
              <dd className="flex gap-1">{k.split(" / ").map((x) => <Kbd key={x}>{x}</Kbd>)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

export function IssuesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { issues, api, setPanel, setFocusRule, state } = useBuilder();
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const jump = (i: (typeof issues)[number]) => {
    onOpenChange(false);
    if (i.ruleId) {
      setPanel("logic");
      setFocusRule(i.ruleId);
      return;
    }
    if (!i.target) return;
    if (state.def.pages.some((p) => p.id === i.target)) api.select({ kind: "page", id: i.target });
    else if (state.def.endings.some((e) => e.id === i.target)) setPanel("endings");
    else {
      api.select({ kind: "fields", ids: [i.target] });
      setPanel("field");
      requestAnimationFrame(() => document.getElementById(`fb-${i.target}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Vor dem Veröffentlichen beheben" description={`${errors.length} ${errors.length === 1 ? "Fehler verhindert" : "Fehler verhindern"} die Veröffentlichung. Klicke auf einen Eintrag, um ihn zu öffnen.`}>
        <ul className="space-y-1">
          {[...errors, ...warnings].map((i, n) => (
            <li key={n}>
              <button type="button" onClick={() => jump(i)} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-[13.5px] leading-snug hover:bg-desk-2">
                <AlertTriangle className={i.severity === "error" ? "mt-0.5 size-4 shrink-0 text-bad" : "mt-0.5 size-4 shrink-0 text-warn"} />
                <span>{i.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function ConflictDialog({ open, onReload, onKeep }: { open: boolean; onReload: () => void; onKeep: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <Dialog open={open}>
      <DialogContent title="Jemand anderes hat das Formular geändert" description="Seit du es geöffnet hast, wurde der Entwurf an anderer Stelle gespeichert – vielleicht in einem zweiten Tab. Deine letzten Änderungen sind noch nicht gespeichert.">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onReload}>Neu laden (andere Fassung übernehmen)</Button>
          <Button variant="primary" loading={pending} onClick={() => start(onKeep)}>Meine Fassung behalten</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Nach dem Veröffentlichen: der Link steht sofort bereit – kopieren, öffnen, QR, weitere Optionen. */
export function PublishedDialog({ formId, published, onClose }: { formId: string; published: { version: number; url: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!published} onOpenChange={(o) => !o && onClose()}>
      {published && (
        <DialogContent title="Dein Formular ist online" description={`Version ${published.version} ist veröffentlicht. Änderungen im Editor bleiben Entwurf, bis du erneut veröffentlichst.`}>
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/forms/${formId}/qr?format=svg`} alt="QR-Code zum Formular" width={96} height={96} className="size-24 shrink-0 rounded-md border border-line bg-white" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <input readOnly value={published.url} aria-label="Öffentlicher Link" onFocus={(e) => e.currentTarget.select()} className="h-9 w-full rounded-md border border-line-strong bg-paper-2 px-2.5 font-mono text-[12.5px] text-ink" />
              <div className="flex flex-wrap gap-2">
                <CopyButton text={published.url} label="Link kopieren" variant="primary" />
                <Button asChild>
                  <a href={published.url} target="_blank" rel="noopener"><ExternalLink /> Öffnen</a>
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">
            Einbetten, QR-Code zum Drucken, Passwort oder Frist: <Link href={`/formulare/${formId}/teilen`} className="font-medium text-stamp hover:underline">Teilen-Optionen öffnen</Link>
          </p>
        </DialogContent>
      )}
    </Dialog>
  );
}
