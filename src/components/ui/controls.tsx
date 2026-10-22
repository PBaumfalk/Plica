"use client";
import { Switch as S, Select as Sel, Checkbox as CB } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Switch({ checked, onCheckedChange, id, disabled, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; disabled?: boolean; label?: string }) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative h-[18px] w-8 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-stamp disabled:opacity-50"
    >
      <S.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-4" />
    </S.Root>
  );
}

export function Checkbox({ checked, onCheckedChange, id, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; label?: string }) {
  return (
    <CB.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      aria-label={label}
      className="grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-paper data-[state=checked]:border-stamp data-[state=checked]:bg-stamp"
    >
      <CB.Indicator>
        <Check className="size-3 text-stamp-ink" strokeWidth={3} />
      </CB.Indicator>
    </CB.Root>
  );
}

/** Segmentierte Auswahl (z. B. Classic / Cards / Wizard). */
export function Segmented<T extends string>({ value, onChange, options, size = "md", label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; size?: "sm" | "md"; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-desk-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          aria-label={typeof o.label === "string" ? undefined : o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] font-medium text-muted transition-all [&_svg]:size-3.5",
            size === "sm" ? "h-6 px-2 text-[12.5px]" : "h-7 px-2.5 text-[13px]",
            value === o.value ? "bg-paper text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ value, onValueChange, options, placeholder, id, className, label }: { value: string | undefined; onValueChange: (v: string) => void; options: { value: string; label: ReactNode }[]; placeholder?: string; id?: string; className?: string; label?: string }) {
  return (
    <Sel.Root value={value} onValueChange={onValueChange}>
      <Sel.Trigger
        id={id}
        aria-label={label}
        className={cn("inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-paper px-2.5 text-left text-[14px] hover:border-faint focus:border-stamp focus:outline-none focus:ring-3 focus:ring-stamp/15 data-[placeholder]:text-faint", className)}
      >
        <Sel.Value placeholder={placeholder} />
        <Sel.Icon>
          <ChevronDown className="size-4 text-muted" />
        </Sel.Icon>
      </Sel.Trigger>
      <Sel.Portal>
        <Sel.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md bg-paper shadow-pop data-[state=open]:animate-pop-in">
          <Sel.Viewport className="p-1">
            {options.map((o) => (
              <Sel.Item key={o.value} value={o.value} className="flex h-8 cursor-default select-none items-center justify-between gap-3 rounded-sm px-2 text-[13.5px] outline-none data-[highlighted]:bg-desk-2">
                <Sel.ItemText>{o.label}</Sel.ItemText>
                <Sel.ItemIndicator>
                  <Check className="size-3.5 text-stamp" />
                </Sel.ItemIndicator>
              </Sel.Item>
            ))}
          </Sel.Viewport>
        </Sel.Content>
      </Sel.Portal>
    </Sel.Root>
  );
}
