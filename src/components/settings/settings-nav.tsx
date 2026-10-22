"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function SettingsNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Einstellungen" className="mb-6 flex gap-1 overflow-x-auto border-b border-line md:mb-0 md:flex-col md:border-b-0">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 shrink-0 items-center rounded-md px-3 text-[13.5px] transition-colors md:h-8",
              active ? "font-medium text-ink max-md:after:absolute max-md:after:inset-x-2 max-md:after:-bottom-px max-md:after:h-0.5 max-md:after:bg-stamp md:bg-paper md:shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-muted hover:text-ink md:hover:bg-desk-2",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
