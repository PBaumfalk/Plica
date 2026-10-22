"use client";
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/controls";
import { cn } from "@/lib/cn";

export const insInput =
  "h-8 w-full rounded-md border border-line bg-paper px-2 text-[13px] text-ink placeholder:text-faint transition-[border,box-shadow] hover:border-line-strong focus:border-stamp focus:outline-none focus:ring-3 focus:ring-stamp/15 aria-[invalid=true]:border-bad";

export function Section({ title, children, defaultOpen = true, id, aside }: { title: string; children: ReactNode; defaultOpen?: boolean; id?: string; aside?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="-ml-1 flex items-center gap-1 rounded-sm px-1 text-[12px] font-semibold uppercase tracking-wider text-muted hover:text-ink">
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          {title}
        </button>
        {aside}
      </div>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

export function Row({ label, children, hint, error, htmlFor }: { label: ReactNode; children: ReactNode; hint?: ReactNode; error?: string | null; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-ink-2">{label}</label>
      {children}
      {error ? <p className="text-[12px] text-bad" role="alert">{error}</p> : hint ? <p className="text-[12px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextIn({ label, value, onChange, placeholder, hint, error, id, mono, multiline, rows = 3, maxLength }: { label: ReactNode; value: string | undefined; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; error?: string | null; id?: string; mono?: boolean; multiline?: boolean; rows?: number; maxLength?: number }) {
  const auto = useId();
  const iid = id ?? auto;
  return (
    <Row label={label} hint={hint} error={error} htmlFor={iid}>
      {multiline ? (
        <textarea id={iid} rows={rows} value={value ?? ""} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={!!error} className={cn(insInput, "h-auto resize-y py-1.5 leading-relaxed", mono && "font-mono text-[12.5px]")} />
      ) : (
        <input id={iid} value={value ?? ""} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={!!error} className={cn(insInput, mono && "font-mono text-[12.5px]")} />
      )}
    </Row>
  );
}

/** Zahl mit lokaler Bearbeitung – leere Eingabe = undefined. */
export function NumIn({ label, value, onChange, placeholder, hint, min, max, step }: { label: ReactNode; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; hint?: ReactNode; min?: number; max?: number; step?: number }) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? "" : String(value).replace(".", ","));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText((t) => {
      const parsed = t.trim() === "" ? undefined : Number(t.replace(",", "."));
      return parsed === value ? t : value === undefined ? "" : String(value).replace(".", ",");
    });
  }, [value]);
  const n = text.trim() === "" ? undefined : Number(text.replace(",", "."));
  const bad = n !== undefined && (!Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max));
  return (
    <Row label={label} hint={hint} htmlFor={id} error={bad ? (min !== undefined && n! < min ? `Mindestens ${min}.` : max !== undefined && n! > max ? `Höchstens ${max}.` : "Bitte eine Zahl.") : null}>
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value);
          const v = e.target.value.trim() === "" ? undefined : Number(e.target.value.replace(",", "."));
          if (v === undefined || (Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max))) onChange(v === undefined ? undefined : step && Number.isInteger(step) ? Math.round(v) : v);
        }}
        className={cn(insInput, "tabular-nums")}
      />
    </Row>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[13px] font-medium text-ink-2">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function NativeSelect<T extends string>({ label, value, onChange, options, hint, id }: { label?: ReactNode; value: T | ""; onChange: (v: T) => void; options: { value: T | ""; label: string; disabled?: boolean }[]; hint?: ReactNode; id?: string }) {
  const auto = useId();
  const sel = (
    <select
      id={id ?? auto}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(insInput, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><path d=%22M3 5l4 4 4-4%22/></svg>')] bg-[length:14px] bg-[right_8px_center] bg-no-repeat pr-7")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
      ))}
    </select>
  );
  if (!label) return sel;
  return <Row label={label} hint={hint} htmlFor={id ?? auto}>{sel}</Row>;
}
