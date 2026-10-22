"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { changePassword } from "@/server/actions/auth";
import { updateProfileAction } from "@/server/actions/settings";
import { useAction } from "./use-action";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [v, setV] = useState({ name, email, password: "" });
  const a = useAction();
  const emailChanged = v.email.trim().toLowerCase() !== email.toLowerCase();
  const dirty = v.name !== name || emailChanged;
  return (
    <form
      className="grid max-w-lg gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => updateProfileAction(v), () => {
          toast("Profil gespeichert");
          setV((x) => ({ ...x, password: "" }));
          router.refresh();
        });
      }}
    >
      <FormRow label="Name" htmlFor="p-name" error={a.fieldErrors.name}>
        <Input id="p-name" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      </FormRow>
      <FormRow label="E-Mail-Adresse" htmlFor="p-email" hint="Mit dieser Adresse meldest du dich an." error={a.fieldErrors.email}>
        <Input id="p-email" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required aria-invalid={!!a.fieldErrors.email} />
      </FormRow>
      {emailChanged && (
        <FormRow label="Aktuelles Passwort" htmlFor="p-pw" hint="Zur Bestätigung der neuen Anmeldeadresse." error={a.fieldErrors.password}>
          <Input id="p-pw" type="password" autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} aria-invalid={!!a.fieldErrors.password} />
        </FormRow>
      )}
      {a.error && !Object.keys(a.fieldErrors).length && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
      <div>
        <Button type="submit" variant="primary" disabled={!dirty} loading={a.pending}>Profil speichern</Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ current: "", next: "", repeat: "" });
  const a = useAction();
  const mismatch = v.repeat.length > 0 && v.next !== v.repeat;
  return (
    <form
      className="grid max-w-lg gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.next !== v.repeat) return a.setError("Die neuen Passwörter stimmen nicht überein.");
        a.run(() => changePassword(v.current, v.next), () => {
          toast("Passwort geändert. Andere Sitzungen wurden beendet.");
          setV({ current: "", next: "", repeat: "" });
        });
      }}
    >
      <FormRow label="Aktuelles Passwort" htmlFor="pw-cur" error={a.fieldErrors.current}>
        <Input id="pw-cur" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} required aria-invalid={!!a.fieldErrors.current} />
      </FormRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Neues Passwort" htmlFor="pw-new" hint="Mindestens 10 Zeichen." error={a.fieldErrors.next}>
          <Input id="pw-new" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} required aria-invalid={!!a.fieldErrors.next} />
        </FormRow>
        <FormRow label="Wiederholen" htmlFor="pw-rep" error={mismatch ? "Stimmt nicht überein." : undefined}>
          <Input id="pw-rep" type="password" autoComplete="new-password" value={v.repeat} onChange={(e) => setV({ ...v, repeat: e.target.value })} required aria-invalid={mismatch} />
        </FormRow>
      </div>
      {a.error && !Object.keys(a.fieldErrors).length && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
      <div>
        <Button type="submit" variant="primary" loading={a.pending} disabled={!v.current || !v.next || mismatch}>Passwort ändern</Button>
      </div>
    </form>
  );
}
