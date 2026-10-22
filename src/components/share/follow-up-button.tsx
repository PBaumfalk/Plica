"use client";
/**
 * „Folgeformular senden“: erzeugt einen signierten Link zu einem anderen
 * veröffentlichten Formular, das mit den Angaben dieser Antwort vorbefüllt ist
 * (Zuordnung über gleiche Feldschlüssel; keine Daten im Link).
 */
import { ExternalLink, Forward } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { createFollowUpLinkAction, followUpTargetsAction } from "@/server/actions/share";
import { CopyButton } from "./copy-field";

export function FollowUpButton({ submissionId, formId }: { submissionId: string; formId: string }) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<{ id: string; title: string }[] | null>(null);
  const [target, setTarget] = useState<string | undefined>();
  const [link, setLink] = useState<{ url: string; matched: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !targets)
          start(async () => {
            const r = await followUpTargetsAction();
            if (!r.ok) return setError(r.error);
            setTargets(r.data);
            const other = r.data.find((t) => t.id !== formId) ?? r.data[0];
            setTarget(other?.id);
          });
        if (!o) setLink(null);
      }}
    >
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} title="Ein weiteres Formular schicken, das mit diesen Angaben vorausgefüllt ist">
        <Forward /> Folgeformular senden
      </Button>
      <DialogContent title="Folgeformular senden" description="Erzeugt einen persönlichen Link. Felder mit gleichem Schlüssel sind bereits ausgefüllt – die Person ergänzt nur, was fehlt.">
        {targets && targets.length === 0 ? (
          <p className="text-[13.5px] text-muted">Es gibt noch kein veröffentlichtes Formular, das als Folgeformular dienen kann.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="fu-target" className="block text-[13px] font-medium text-ink-2">Zielformular</label>
              <Select id="fu-target" value={target} onValueChange={(v) => (setTarget(v), setLink(null))} options={(targets ?? []).map((t) => ({ value: t.id, label: t.title }))} placeholder={targets ? "Formular wählen" : "Wird geladen …"} />
            </div>
            {link ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input readOnly value={link.url} aria-label="Link zum Folgeformular" onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border border-line bg-paper-2 px-3 font-mono text-[12px]" />
                  <CopyButton text={link.url} variant="primary" />
                </div>
                <p className="text-[12.5px] text-muted">
                  {link.matched === 0 ? "Keine passenden Felder gefunden – das Formular öffnet leer." : `${link.matched} ${link.matched === 1 ? "Feld wird" : "Felder werden"} vorbefüllt.`} Der Link ist 30 Tage gültig. Einwilligungen und Unterschriften werden nie übernommen.
                </p>
                <Button asChild variant="ghost" size="sm"><a href={link.url} target="_blank" rel="noopener"><ExternalLink /> Ansehen</a></Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={!target}
                  loading={pending}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const r = await createFollowUpLinkAction(submissionId, target!);
                      if (!r.ok) return setError(r.error);
                      setLink(r.data);
                    })
                  }
                >
                  Link erzeugen
                </Button>
              </div>
            )}
            {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
