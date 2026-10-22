import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Einstellungsabschnitt: Erklärung links, Bedienung rechts – auf schmalen Bildschirmen untereinander. */
export function Section({ title, description, children, tone, id }: { title: ReactNode; description?: ReactNode; children: ReactNode; tone?: "danger"; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("rounded-lg bg-paper p-5 shadow-sheet sm:p-6", tone === "danger" && "ring-1 ring-bad/25")}>
      <div className="mb-5">
        <h2 id={id ? `${id}-title` : undefined} className={cn("text-[15px] font-semibold", tone === "danger" && "text-bad")}>{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}
