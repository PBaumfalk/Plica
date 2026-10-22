"use client";
import { Check, ChevronDown } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import type { Status } from "./types";

export const STATUS_META: Record<Status, { label: string; dot: string; chip: string }> = {
  new: { label: "Neu", dot: "bg-stamp", chip: "bg-stamp-soft text-stamp" },
  in_review: { label: "In Prüfung", dot: "bg-warn", chip: "bg-warn-soft text-warn" },
  approved: { label: "Freigegeben", dot: "bg-ok", chip: "bg-ok-soft text-ok" },
  rejected: { label: "Abgelehnt", dot: "bg-bad", chip: "bg-bad-soft text-bad" },
  done: { label: "Erledigt", dot: "bg-faint", chip: "bg-desk-2 text-ink-2" },
  spam: { label: "Spam", dot: "bg-line-strong", chip: "bg-desk-2 text-muted" },
};

export const STATUS_ORDER: Status[] = ["new", "in_review", "approved", "rejected", "done", "spam"];

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 text-[12px] font-medium whitespace-nowrap", m.chip, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function StatusMenu({ status, onChange, disabled }: { status: Status; onChange: (s: Status) => void; disabled?: boolean }) {
  if (disabled) return <StatusChip status={status} />;
  return (
    <Menu>
      <MenuTrigger className="group inline-flex items-center gap-0.5 rounded-sm focus-visible:outline-2" aria-label={`Status: ${STATUS_META[status].label}. Ändern`}>
        <StatusChip status={status} />
        <ChevronDown className="size-3.5 text-faint group-hover:text-ink" />
      </MenuTrigger>
      <MenuContent align="start">
        {STATUS_ORDER.map((s, i) => (
          <MenuItem key={s} onSelect={() => onChange(s)} shortcut={String(i + 1)}>
            <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} />
            {STATUS_META[s].label}
            {s === status && <Check className="ml-1 !text-stamp" />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
