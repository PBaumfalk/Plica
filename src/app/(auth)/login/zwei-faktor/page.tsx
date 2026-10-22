"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { logout, verifySecondFactor } from "@/server/actions/auth";

export default function SecondFactorPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  return (
    <div className="rounded-lg bg-paper p-7 shadow-sheet">
      <h1 className="font-display text-[26px] leading-tight font-[450]">Bestätigungscode</h1>
      <p className="mt-2 text-[14px] text-muted">Gib den sechsstelligen Code aus deiner Authenticator-App ein – oder einen Wiederherstellungscode.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await verifySecondFactor(code);
            if (!r.ok) return setError(r.error);
            router.replace("/");
            router.refresh();
          });
        }}
      >
        <FormRow label="Code" htmlFor="otp" error={error}>
          <Input id="otp" autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-[18px] tracking-[0.3em]" aria-invalid={!!error} />
        </FormRow>
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>Bestätigen</Button>
        <button type="button" onClick={() => logout()} className="w-full text-center text-[13px] text-muted hover:text-ink">Abbrechen</button>
      </form>
    </div>
  );
}
