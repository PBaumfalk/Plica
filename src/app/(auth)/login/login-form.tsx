"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { login } from "@/server/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await login({ email: String(fd.get("email")), password: String(fd.get("password")) });
      if (!r.ok) return setError(r.error);
      router.replace(r.data.next === "mfa" ? "/login/zwei-faktor" : "/");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-paper p-7 shadow-sheet">
      <h1 className="font-display text-[26px] leading-tight font-[450]">Anmelden</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <FormRow label="E-Mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" autoFocus required />
        </FormRow>
        <FormRow label="Passwort" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!error} />
        </FormRow>
        {error && <p className="text-[13px] text-bad" role="alert">{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>Anmelden</Button>
      </form>
    </div>
  );
}
