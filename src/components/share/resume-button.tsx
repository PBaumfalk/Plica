"use client";
/** „Später fortsetzen“: speichert den Zwischenstand und zeigt einen privaten Link. */
import { Dialog as D } from "radix-ui";
import { Bookmark, Check, Copy, Loader2, Mail, X } from "lucide-react";
import { useState } from "react";
import type { Answers } from "@/lib/forms/logic";

export function ResumeButton({ endpoint, token, answers, pageId, resume }: { endpoint: string; token: string; answers: Answers; pageId?: string; resume: { get: () => string | undefined; set: (token: string) => void } }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function save(withEmail?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, answers, pageId, resume: resume.get(), email: withEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? "Speichern hat nicht geklappt.");
      resume.set(data.resume);
      setLink(data.link);
      setExpires(new Date(data.expiresAt).toLocaleDateString("de-DE", { dateStyle: "long" }));
      if (data.emailed) setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keine Verbindung. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSent(false);
          setCopied(false);
          void save();
        }
      }}
    >
      <D.Trigger asChild>
        <button type="button" className="inline-flex h-12 items-center gap-2 rounded-[var(--f-radius)] px-3 text-[14.5px] font-medium text-[var(--f-muted)] hover:bg-[var(--f-tint)] hover:text-[var(--f-ink)]">
          <Bookmark className="size-4" /> Später fortsetzen
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_17_23/0.38)] data-[state=open]:animate-fade-in" />
        <D.Content className="plica-form fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 rounded-lg bg-paper p-6 shadow-pop data-[state=open]:animate-pop-in focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-[17px] font-semibold">Später fortsetzen</D.Title>
              <D.Description className="mt-1 text-[14px] leading-relaxed text-[var(--f-muted)]">
                Ihre bisherigen Angaben sind verschlüsselt gespeichert. Mit diesem Link machen Sie später weiter{expires ? ` – gültig bis ${expires}` : ""}.
              </D.Description>
            </div>
            <D.Close className="rounded p-1 text-[var(--f-muted)] hover:bg-[var(--f-tint)]" aria-label="Schließen">
              <X className="size-4" />
            </D.Close>
          </div>
          {busy && !link ? (
            <div className="flex items-center gap-2 py-6 text-[14px] text-[var(--f-muted)]">
              <Loader2 className="size-4 animate-spin" /> Zwischenstand wird gespeichert …
            </div>
          ) : link ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <label htmlFor="resume-link" className="sr-only">Privater Link</label>
                <input id="resume-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-md border border-[var(--f-line)] bg-[var(--f-tint)] px-3 font-mono text-[12.5px]" />
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[var(--f-accent)] px-3.5 text-[14px] font-semibold text-[var(--f-accent-ink)] hover:brightness-110"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Kopiert" : "Kopieren"}
                </button>
              </div>
              <p className="rounded-md bg-[var(--f-tint)] px-3 py-2 text-[13px] leading-relaxed text-[var(--f-ink-2)]">Bitte geben Sie den Link nicht weiter: Wer ihn kennt, sieht Ihre bisherigen Angaben.</p>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(email);
                }}
              >
                <label htmlFor="resume-email" className="block text-[13.5px] font-medium">Link an mich senden</label>
                <div className="flex gap-2">
                  <input id="resume-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.de" className="h-10 min-w-0 flex-1 rounded-md border border-[var(--f-line)] bg-[var(--f-field)] px-3 text-[14px] focus:border-[var(--f-accent)] focus:outline-none" />
                  <button type="submit" disabled={busy || !email} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--f-line)] px-3.5 text-[14px] font-medium hover:border-[var(--f-line-strong)] disabled:opacity-50">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Senden
                  </button>
                </div>
                {sent && <p className="text-[13px] text-[var(--f-accent)]" role="status">Der Link ist unterwegs.</p>}
              </form>
            </div>
          ) : null}
          {error && <p role="alert" className="mt-3 text-[13.5px] text-[var(--f-bad)]">{error}</p>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
