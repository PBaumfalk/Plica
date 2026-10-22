"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { logout } from "@/server/actions/auth";
import { acceptInvitationAction, registerWithInvitationAction } from "@/server/actions/team";
import { useAction } from "@/components/settings/use-action";

export function AcceptInvitation(p: { token: string; workspace: string; invitedBy: string | null; email: string; role: string; roleDescription: string; viewer: { name: string; email: string } | null }) {
  const router = useRouter();
  const a = useAction();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const matches = p.viewer && p.viewer.email.toLowerCase() === p.email.toLowerCase();
  const done = () => { router.replace("/"); router.refresh(); };

  return (
    <div className="rounded-lg bg-paper p-7 shadow-sheet">
      <p className="text-[12.5px] font-medium text-muted">Einladung{p.invitedBy ? ` von ${p.invitedBy}` : ""}</p>
      <h1 className="mt-1 font-display text-[26px] leading-tight font-[450]">{p.workspace}</h1>
      <div className="mt-4 rounded-md bg-desk px-3 py-2.5 text-[13.5px]">
        <span className="font-medium">{p.role}</span>
        <span className="text-muted"> – {p.roleDescription}</span>
      </div>

      {p.viewer && matches && (
        <div className="mt-6 space-y-3">
          <p className="text-[14px] text-ink-2">Angemeldet als <strong className="font-medium">{p.viewer.email}</strong>.</p>
          {a.error && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
          <Button variant="primary" size="lg" className="w-full justify-center" loading={a.pending} onClick={() => a.run(() => acceptInvitationAction(p.token), done)}>
            Einladung annehmen
          </Button>
        </div>
      )}

      {p.viewer && !matches && (
        <div className="mt-6 space-y-3">
          <p className="text-[14px] leading-relaxed text-ink-2">Diese Einladung gilt für <strong className="font-medium">{p.email}</strong>, du bist aber als {p.viewer.email} angemeldet.</p>
          <Button variant="secondary" className="w-full justify-center" onClick={() => logout()}>Abmelden und neu anmelden</Button>
        </div>
      )}

      {!p.viewer && (
        <form className="mt-6 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          a.run(() => registerWithInvitationAction({ token: p.token, name, password: pw }), done);
        }}>
          <p className="text-[14px] text-ink-2">Lege dein Konto für <strong className="font-medium">{p.email}</strong> an.</p>
          <FormRow label="Name" htmlFor="inv-name" error={a.fieldErrors.name}>
            <Input id="inv-name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Passwort" htmlFor="inv-pw" hint="Mindestens 10 Zeichen." error={a.fieldErrors.password}>
            <Input id="inv-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!a.fieldErrors.password} />
          </FormRow>
          {a.error && !Object.keys(a.fieldErrors).length && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={a.pending}>Konto anlegen und beitreten</Button>
          <p className="text-center text-[13px] text-muted">Du hast schon ein Konto? <Link href="/login" className="text-stamp hover:underline">Anmelden</Link> und den Link danach erneut öffnen.</p>
        </form>
      )}
    </div>
  );
}
