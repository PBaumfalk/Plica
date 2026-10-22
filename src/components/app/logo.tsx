import { cn } from "@/lib/cn";

/** Bildmarke: ein Blatt mit Falz. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <path d="M5 3.5h9.5L19 8v12.5H5z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.5 3.5V8H19" fill="var(--stamp)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 12.5h7M8.5 16h4.5" stroke="var(--stamp)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-[19px] font-[520] tracking-[0.02em]">plica</span>
    </span>
  );
}
