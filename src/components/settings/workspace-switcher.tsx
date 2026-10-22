"use client";
/** Workspace-Wechsel in der Seitenleiste. Die Liste wird beim Öffnen frisch geladen. */
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlays";
import { listWorkspacesAction, switchWorkspaceAction } from "@/server/actions/settings";
import { ROLE_NAMES } from "./audit-labels";
import { CreateWorkspace } from "./workspace";

export function WorkspaceSwitcher({ workspace, roleLabel, logo }: { workspace: string; roleLabel: string; logo: React.ReactNode }) {
  const router = useRouter();
  const [list, setList] = useState<{ id: string; name: string; role: string; current: boolean }[] | null>(null);
  const [, start] = useTransition();
  return (
    <div className="flex items-center">
      <Menu onOpenChange={(o) => o && start(async () => {
        const r = await listWorkspacesAction();
        if (r.ok) setList(r.data);
      })}>
        <MenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-desk-2" aria-label={`Workspace: ${workspace}. Wechseln`}>
          {logo}
          <span className="min-w-0 flex-1 max-md:hidden">
            <span className="block truncate text-[13.5px] font-semibold leading-tight">{workspace}</span>
            <span className="block text-[11.5px] text-muted">{roleLabel}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-faint max-md:hidden" />
        </MenuTrigger>
        <MenuContent align="start" className="w-64">
          <MenuLabel>Workspaces</MenuLabel>
          {!list && <div className="px-2 py-1.5 text-[13px] text-muted">Lädt …</div>}
          {list?.map((w) => (
            <MenuItem
              key={w.id}
              onSelect={() => {
                if (w.current) return;
                start(async () => {
                  const r = await switchWorkspaceAction(w.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast(`Gewechselt zu „${w.name}“`);
                  router.push("/");
                  router.refresh();
                });
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{w.name}</span>
                <span className="block text-[11.5px] text-muted">{ROLE_NAMES[w.role] ?? w.role}</span>
              </span>
              {w.current && <Check className="!text-stamp" />}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem asChild>
            <Link href="/einstellungen/workspace"><Settings2 /> Workspace-Einstellungen</Link>
          </MenuItem>
          <CreateWorkspaceItem />
        </MenuContent>
      </Menu>
    </div>
  );
}

function CreateWorkspaceItem() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}><Plus /> Neuer Workspace</MenuItem>
      {open && <CreateWorkspaceDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  return <CreateWorkspace openInitially onClosed={onClose} />;
}
