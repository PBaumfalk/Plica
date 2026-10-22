"use client";
/**
 * ⌘K: Navigation, Aktionen und Formulare an einem Ort.
 * Seiten können eigene Befehle über `useCommands` registrieren.
 */
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/overlays";

export interface Cmd {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string;
  run: () => void;
}

type Ctx = { register: (owner: string, cmds: Cmd[]) => void; unregister: (owner: string) => void; open: () => void };
const CommandCtx = createContext<Ctx | null>(null);

export function useCommands(owner: string, cmds: Cmd[]) {
  const ctx = useContext(CommandCtx);
  const ref = useRef(cmds);
  ref.current = cmds;
  const sig = cmds.map((c) => c.id + c.label).join("|");
  useEffect(() => {
    ctx?.register(owner, ref.current);
    return () => ctx?.unregister(owner);
  }, [ctx, owner, sig]);
}

export function useOpenPalette() {
  return useContext(CommandCtx)?.open ?? (() => {});
}

export function CommandProvider({ base, forms, children }: { base: Cmd[]; forms: { id: string; title: string }[]; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<Record<string, Cmd[]>>({});
  const register = useCallback((owner: string, cmds: Cmd[]) => setExtra((e) => ({ ...e, [owner]: cmds })), []);
  const unregister = useCallback((owner: string) => setExtra((e) => {
    const n = { ...e };
    delete n[owner];
    return n;
  }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all = useMemo(() => [...Object.values(extra).flat(), ...base], [extra, base]);
  const groups = useMemo(() => {
    const m = new Map<string, Cmd[]>();
    for (const c of all) m.set(c.group, [...(m.get(c.group) ?? []), c]);
    return [...m.entries()];
  }, [all]);

  const run = (fn: () => void) => {
    setOpen(false);
    requestAnimationFrame(fn);
  };

  const ctx = useMemo(() => ({ register, unregister, open: () => setOpen(true) }), [register, unregister]);

  return (
    <CommandCtx.Provider value={ctx}>
      {children}
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_17_23/0.3)] data-[state=open]:animate-fade-in" />
          <D.Content aria-describedby={undefined} className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-32px)] max-w-[580px] -translate-x-1/2 overflow-hidden rounded-lg bg-paper shadow-pop data-[state=open]:animate-pop-in">
            <D.Title className="sr-only">Befehle</D.Title>
            <Command loop label="Befehle" className="flex flex-col">
              <div className="flex items-center gap-2.5 border-b border-line px-4">
                <Search className="size-4 text-muted" />
                <Command.Input autoFocus placeholder="Wohin oder was tun?" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
                <Kbd>esc</Kbd>
              </div>
              <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-8 text-center text-[13.5px] text-muted">Nichts gefunden.</Command.Empty>
                {groups.map(([g, cmds]) => (
                  <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint">
                    {cmds.map((c) => (
                      <Command.Item key={c.id} value={`${c.label} ${c.keywords ?? ""} ${c.id}`} onSelect={() => run(c.run)} className="flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-[14px] data-[selected=true]:bg-desk-2 [&_svg]:size-4 [&_svg]:text-muted">
                        {c.icon}
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
                {forms.length > 0 && (
                  <Command.Group heading="Formulare" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint">
                    {forms.map((f) => (
                      <Command.Item key={f.id} value={`formular ${f.title} ${f.id}`} onSelect={() => run(() => router.push(`/formulare/${f.id}/bearbeiten`))} className="flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-[14px] data-[selected=true]:bg-desk-2 [&_svg]:size-4 [&_svg]:text-muted">
                        <FileText />
                        <span className="flex-1 truncate">{f.title}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
    </CommandCtx.Provider>
  );
}
