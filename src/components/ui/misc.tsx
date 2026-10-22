import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-desk-2 text-ink-2",
  stamp: "bg-stamp-soft text-stamp",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
} as const;

export function Badge({ tone = "neutral", children, className, dot }: { tone?: keyof typeof tones; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Leerer Zustand: sagt, was hier hingehört, und bietet den nächsten Schritt an. */
export function Empty({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-lg border border-line bg-paper text-muted shadow-sheet [&_svg]:size-5">{icon}</div>}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children && <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12.5px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[30px] leading-tight font-[450] tracking-[-0.015em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-desk-2", className)} />;
}
