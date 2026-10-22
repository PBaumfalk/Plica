"use client";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Untere Schublade für schmale Bildschirme (Palette, Inspektor). */
export function MobileSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_17_23/0.3)] data-[state=open]:animate-fade-in lg:hidden" />
        <D.Content data-builder-sheet aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-xl bg-paper shadow-pop data-[state=open]:animate-rise lg:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="mx-auto mb-1 h-1 w-10 rounded-full bg-line-strong absolute left-1/2 top-1.5 -translate-x-1/2" aria-hidden />
            <D.Title className="text-[14px] font-semibold">{title}</D.Title>
            <D.Close className="rounded-sm p-1 text-muted hover:bg-desk-2" aria-label="Schließen"><X className="size-4" /></D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
