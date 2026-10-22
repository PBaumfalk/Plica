"use client";
import { Check, Copy, Download, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { FormRow, Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { confirmTotpSetup, disableTotp, startTotpSetup } from "@/server/actions/auth";
import { useAction } from "./use-action";

export function TwoFactor({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [pw, setPw] = useState("");

  if (codes) {
    const text = `PLICA – Wiederherstellungscodes\nJeder Code funktioniert genau einmal.\n\n${codes.join("\n")}\n`;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[14px] font-medium text-ok"><ShieldCheck className="size-4" /> Zwei-Faktor-Anmeldung ist aktiv.</div>
        <p className="text-[13.5px] text-muted">Bewahre diese Wiederherstellungscodes sicher auf. Sie werden nur jetzt angezeigt und helfen, wenn dein Telefon nicht verfügbar ist.</p>
        <ul className="grid max-w-md grid-cols-2 gap-2 rounded-md bg-desk p-4 font-mono text-[14px] tracking-wider">
          {codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "plica-wiederherstellungscodes.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}><Download /> Als Textdatei speichern</Button>
          <Button onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => toast("Codes kopiert"))}><Copy /> Kopieren</Button>
          <Button variant="primary" onClick={() => { setCodes(null); router.refresh(); }}><Check /> Gespeichert</Button>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="ok" dot>Aktiv</Badge>
        <Button variant="secondary" onClick={() => setDisableOpen(true)}>Deaktivieren …</Button>
        <Dialog open={disableOpen} onOpenChange={(o) => { setDisableOpen(o); setPw(""); a.setError(null); }}>
          <DialogContent title="Zwei-Faktor-Anmeldung deaktivieren?" description="Danach genügt wieder das Passwort zur Anmeldung. Bestätige mit deinem Passwort.">
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              a.run(() => disableTotp(pw), () => { setDisableOpen(false); toast("Zwei-Faktor-Anmeldung deaktiviert"); router.refresh(); });
            }}>
              <FormRow label="Passwort" htmlFor="tf-pw" error={a.error}>
                <Input id="tf-pw" type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!a.error} />
              </FormRow>
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => setDisableOpen(false)}>Abbrechen</Button>
                <Button type="submit" variant="danger" loading={a.pending}>Deaktivieren</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="warn" dot>Nicht eingerichtet</Badge>
        <Button variant="primary" loading={a.pending} onClick={() => a.run(() => startTotpSetup(), (d) => setSetup(d))}>Einrichten</Button>
        {a.error && <p role="alert" className="w-full text-[13px] text-bad">{a.error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="rounded-md bg-white p-2 shadow-[0_0_0_1px_var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr} alt="QR-Code für die Authenticator-App" className="size-full" />
      </div>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        a.run(() => confirmTotpSetup(code), (d) => { setSetup(null); setCode(""); setCodes(d.recoveryCodes); });
      }}>
        <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2">
          <li>QR-Code mit der Authenticator-App scannen.</li>
          <li>Geht das nicht, den Schlüssel von Hand eingeben:<br /><code className="mt-1 inline-block break-all rounded-xs bg-desk px-1.5 py-0.5 font-mono text-[12.5px]">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code></li>
          <li>Den angezeigten sechsstelligen Code eintragen.</li>
        </ol>
        <FormRow label="Code aus der App" htmlFor="tf-code" error={a.error}>
          <Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="max-w-40 font-mono text-[16px] tracking-[0.25em]" aria-invalid={!!a.error} />
        </FormRow>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={a.pending} disabled={code.replace(/\s/g, "").length < 6}>Bestätigen und aktivieren</Button>
          <Button type="button" variant="ghost" onClick={() => { setSetup(null); setCode(""); }}>Abbrechen</Button>
        </div>
      </form>
    </div>
  );
}
