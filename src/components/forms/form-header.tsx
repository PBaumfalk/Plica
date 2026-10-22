"use client";
import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { FormStatusBadge } from "./status";

export function FormHeader({ id, title, status, slug, submissions, published }: { id: string; title: string; status: "draft" | "published" | "paused" | "archived"; slug: string; submissions: number; published: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: `/formulare/${id}/bearbeiten`, label: "Bearbeiten" },
    { href: `/formulare/${id}/teilen`, label: "Teilen" },
    { href: `/formulare/${id}/antworten`, label: "Antworten", count: submissions },
    { href: `/formulare/${id}/automationen`, label: "Automationen" },
    { href: `/formulare/${id}/auswertung`, label: "Auswertung" },
    { href: `/formulare/${id}/pdf`, label: "PDF-Vorlage" },
  ];
  return (
    <header className="mb-6">
      <nav aria-label="Pfad" className="mb-2 flex items-center gap-1 text-[12.5px] text-muted">
        <Link href="/" className="hover:text-ink">Formulare</Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-ink-2">{title || "Unbenanntes Formular"}</span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate font-display text-[28px] leading-tight font-[450] tracking-[-0.015em]">{title || "Unbenanntes Formular"}</h1>
          <FormStatusBadge status={status} />
        </div>
        {published && status !== "archived" && (
          <Button asChild size="sm" variant="secondary">
            <a href={`/f/${slug}`} target="_blank" rel="noopener"><ExternalLink /> Öffentliche Ansicht</a>
          </Button>
        )}
      </div>
      <nav aria-label="Formularbereiche" className="mt-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative -mb-px flex h-9 shrink-0 items-center gap-1.5 px-3 text-[13.5px] transition-colors", active ? "font-medium text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-stamp" : "text-muted hover:text-ink")}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-desk-2 px-1.5 text-[11px] tabular text-muted">{t.count}</span>}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
