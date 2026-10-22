import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nicht gefunden" };

/** Auch für öffentliche Formularlinks mit Tippfehler – daher in der „Sie“-Form. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-[460px] rounded-lg bg-paper px-8 py-10 text-center shadow-sheet animate-rise">
        <p className="font-mono text-[12px] tracking-wider text-muted">404</p>
        <h1 className="mt-2 font-display text-[28px] leading-tight font-[450] tracking-[-0.01em]">Diese Seite gibt es nicht</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Vielleicht enthält der Link einen Tippfehler, oder das Formular wurde inzwischen geschlossen. Bitte prüfen Sie die Adresse oder wenden Sie sich an die Stelle, von der Sie den Link erhalten haben.
        </p>
      </div>
    </main>
  );
}
