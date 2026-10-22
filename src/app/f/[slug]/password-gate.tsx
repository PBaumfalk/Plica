"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { unlockForm } from "@/server/actions/public";

export function PasswordGate({ slug, title, embedded, icon, prefill }: { slug: string; title: string; embedded: boolean; icon: ReactNode; prefill?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mx-auto max-w-sm py-10 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        const pw = String(new FormData(e.currentTarget).get("password") ?? "");
        start(async () => {
          const r = await unlockForm(slug, pw);
          if (!r.ok) return setError(r.error);
          router.replace(`/f/${slug}?k=${encodeURIComponent(r.key)}${embedded ? "&embed=1" : ""}${prefill ? `&prefill=${encodeURIComponent(prefill)}` : ""}`);
        });
      }}
    >
      <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-desk text-muted">{icon}</div>
      <h1 className="font-display text-[26px] font-[450]">{title}</h1>
      <p className="mt-2 text-[15px] text-muted">Dieses Formular ist geschützt. Bitte geben Sie das Passwort ein, das Sie erhalten haben.</p>
      <label htmlFor="pw" className="sr-only">Passwort</label>
      <input id="pw" name="password" type="password" autoFocus required className="mt-6 h-11 w-full rounded-md border border-line-strong bg-paper px-3 text-[15px] focus:border-stamp focus:outline-none focus:ring-3 focus:ring-stamp/15" aria-invalid={!!error} aria-describedby={error ? "pw-err" : undefined} />
      {error && <p id="pw-err" role="alert" className="mt-2 text-[13.5px] text-bad">{error}</p>}
      <button type="submit" disabled={pending} className="mt-4 h-11 w-full rounded-md bg-stamp text-[15px] font-semibold text-stamp-ink hover:brightness-110 disabled:opacity-70">
        {pending ? "Wird geprüft …" : "Formular öffnen"}
      </button>
    </form>
  );
}
