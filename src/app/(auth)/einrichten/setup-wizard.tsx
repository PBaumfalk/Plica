"use client";
import { ArrowRight, KeyRound, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { checkSetupCode, completeSetup } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

const STEPS = ["Code", "Konto", "Workspace"] as const;

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [v, setV] = useState({ code: "", name: "", email: "", password: "", workspace: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    start(async () => {
      if (step === 0) {
        const r = await checkSetupCode(v.code);
        if (!r.ok) return setError(r.error);
        setStep(1);
      } else if (step === 1) {
        if (v.password.length < 10) return setFieldErrors({ password: "Mindestens 10 Zeichen." });
        if (!v.name.trim() || !/.+@.+\..+/.test(v.email)) return setError("Bitte Name und E-Mail-Adresse angeben.");
        setStep(2);
      } else {
        const r = await completeSetup(v);
        if (!r.ok) {
          setError(r.error);
          setFieldErrors(r.fieldErrors ?? {});
          if (r.fieldErrors?.password || r.fieldErrors?.email) setStep(1);
          if (r.fieldErrors?.code) setStep(0);
          return;
        }
        router.replace("/willkommen");
      }
    });
  }

  return (
    <div className="rounded-lg bg-paper p-7 shadow-sheet">
      <ol className="mb-7 flex items-center gap-2 text-[12.5px]" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-semibold", i < step ? "bg-ok text-white" : i === step ? "bg-stamp text-stamp-ink" : "bg-desk-2 text-muted")}>{i + 1}</span>
            <span className={cn(i === step ? "font-medium text-ink" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
          </li>
        ))}
      </ol>

      <form onSubmit={next} className="space-y-5" noValidate>
        {step === 0 && (
          <>
            <div>
              <h1 className="font-display text-[26px] leading-tight font-[450] tracking-[-0.01em]">PLICA einrichten</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                Zum Schutz vor Fremdzugriff gibt es kein Standardpasswort. PLICA hat beim Start einen Einrichtungscode ins Server-Log geschrieben.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-md bg-desk px-3 py-2.5 text-[13px] text-ink-2">
              <Terminal className="mt-0.5 size-4 shrink-0 text-muted" />
              <code className="font-mono text-[12.5px]">docker compose logs app | grep Einrichtungscode</code>
            </div>
            <FormRow label="Einrichtungscode" htmlFor="code" error={error}>
              <Input id="code" autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="1234-5678-9012" value={v.code} onChange={set("code")} className="font-mono tracking-wider" aria-invalid={!!error} />
            </FormRow>
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <h1 className="font-display text-[26px] leading-tight font-[450]">Dein Konto</h1>
              <p className="mt-2 text-[14px] text-muted">Du wirst Inhaber und kannst später weitere Personen einladen.</p>
            </div>
            <FormRow label="Name" htmlFor="name">
              <Input id="name" autoFocus autoComplete="name" value={v.name} onChange={set("name")} />
            </FormRow>
            <FormRow label="E-Mail" htmlFor="email" error={fieldErrors.email}>
              <Input id="email" type="email" autoComplete="email" value={v.email} onChange={set("email")} />
            </FormRow>
            <FormRow label="Passwort" htmlFor="password" hint="Mindestens 10 Zeichen. Ein Satz ist leichter zu merken als Sonderzeichen." error={fieldErrors.password}>
              <Input id="password" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} aria-invalid={!!fieldErrors.password} />
            </FormRow>
            {error && <p className="text-[13px] text-bad" role="alert">{error}</p>}
          </>
        )}
        {step === 2 && (
          <>
            <div>
              <h1 className="font-display text-[26px] leading-tight font-[450]">Dein Workspace</h1>
              <p className="mt-2 text-[14px] text-muted">Ein Workspace bündelt Formulare, Antworten und Team – zum Beispiel deine Kanzlei oder Abteilung.</p>
            </div>
            <FormRow label="Name des Workspace" htmlFor="workspace" error={fieldErrors.workspace}>
              <Input id="workspace" autoFocus placeholder="z. B. Kanzlei Musterstadt" value={v.workspace} onChange={set("workspace")} />
            </FormRow>
            {error && <p className="text-[13px] text-bad" role="alert">{error}</p>}
          </>
        )}
        <div className="flex items-center justify-between pt-1">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>Zurück</Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><KeyRound className="size-3.5" />Einmalig</span>
          )}
          <Button type="submit" variant="primary" loading={pending}>
            {step === 2 ? "Einrichtung abschließen" : "Weiter"}
            {!pending && <ArrowRight />}
          </Button>
        </div>
      </form>
    </div>
  );
}
