"use client";
import { Dialog as D, DropdownMenu as DM, ContextMenu as CM, Popover as P, Tooltip as T } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------- Dialog ---------- */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, wide }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_17_23/0.38)] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-[12vh] z-50 max-h-[80vh] w-[calc(100vw-32px)] -translate-x-1/2 overflow-y-auto rounded-lg bg-paper p-5 shadow-pop data-[state=open]:animate-pop-in focus:outline-none",
          wide ? "max-w-2xl" : "max-w-md",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-[16px] font-semibold tracking-[-0.01em]">{title}</D.Title>
            {description && <D.Description className="mt-1 text-[13.5px] text-muted">{description}</D.Description>}
          </div>
          <D.Close className="-mr-1 -mt-1 rounded-sm p-1 text-muted hover:bg-desk-2 hover:text-ink" aria-label="Schließen">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

/* ---------- Menüs ---------- */
const menuSurface = "z-50 min-w-48 overflow-hidden rounded-md bg-paper p-1 shadow-pop data-[state=open]:animate-pop-in";
const itemCls =
  "flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-[13.5px] text-ink outline-none data-[highlighted]:bg-desk-2 data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-muted";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;
export function MenuContent({ className, align = "end", ...p }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={6} align={align} className={cn(menuSurface, className)} {...p} />
    </DM.Portal>
  );
}
export function MenuItem({ className, danger, shortcut, children, ...p }: ComponentProps<typeof DM.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <DM.Item className={cn(itemCls, danger && "text-bad [&_svg]:text-bad", className)} {...p}>
      {children}
      {shortcut && <Kbd className="ml-auto">{shortcut}</Kbd>}
    </DM.Item>
  );
}
export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <DM.Label className="px-2 pb-1 pt-1.5 text-[11.5px] font-medium uppercase tracking-wider text-faint">{children}</DM.Label>;

export const ContextMenu = CM.Root;
export const ContextMenuTrigger = CM.Trigger;
export function ContextMenuContent({ className, ...p }: ComponentProps<typeof CM.Content>) {
  return (
    <CM.Portal>
      <CM.Content className={cn(menuSurface, className)} {...p} />
    </CM.Portal>
  );
}
export function ContextMenuItem({ className, danger, shortcut, children, ...p }: ComponentProps<typeof CM.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <CM.Item className={cn(itemCls, danger && "text-bad [&_svg]:text-bad", className)} {...p}>
      {children}
      {shortcut && <Kbd className="ml-auto">{shortcut}</Kbd>}
    </CM.Item>
  );
}
export const ContextMenuSeparator = () => <CM.Separator className="my-1 h-px bg-line" />;

/* ---------- Popover & Tooltip ---------- */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export function PopoverContent({ className, ...p }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content sideOffset={6} className={cn("z-50 rounded-md bg-paper p-3 shadow-pop data-[state=open]:animate-pop-in focus:outline-none", className)} {...p} />
    </P.Portal>
  );
}

export const TooltipProvider = T.Provider;
export function Tip({ label, shortcut, children, side = "bottom" }: { label: ReactNode; shortcut?: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={350}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[60] flex items-center gap-2 rounded-sm bg-ink px-2 py-1 text-[12px] text-paper shadow-pop data-[state=delayed-open]:animate-fade-in">
          {label}
          {shortcut && <span className="font-mono text-[11px] opacity-60">{shortcut}</span>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-paper-2 px-1 font-mono text-[11px] text-muted", className)}>{children}</kbd>;
}
