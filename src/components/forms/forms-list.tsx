"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { Archive, ChevronDown, Copy, ExternalLink, FileStack, Inbox, LayoutTemplate, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useCreateForm } from "@/components/app/app-shell";
import { useCommands } from "@/components/app/command-palette";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader } from "@/components/ui/misc";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, Dialog, DialogContent, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlays";
import { Segmented } from "@/components/ui/controls";
import { cn } from "@/lib/cn";

import { deleteFormAction, duplicateFormAction, setStatusAction } from "@/server/actions/forms";
import { FormStatusBadge } from "./status";
import { DescribeDialog } from "@/components/templates/describe-dialog";

type Row = { id: string; title: string; slug: string; status: "draft" | "published" | "paused" | "archived"; mode: string; submissions: number; newCount: number; lastSubmissionAt: string | null; updatedAt: string };

const MODE = { classic: "Classic", cards: "Cards", wizard: "Wizard" } as Record<string, string>;

export function FormsList({ forms, canWrite, canDelete }: { forms: Row[]; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { create, pending } = useCreateForm();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [describe, setDescribe] = useState(false);

  const shown = useMemo(
    () => forms.filter((f) => (filter === "archived" ? f.status === "archived" : f.status !== "archived")).filter((f) => !q || f.title.toLowerCase().includes(q.toLowerCase())),
    [forms, q, filter],
  );

  useCommands(
    "forms-list",
    canWrite
      ? [
          { id: "templates", label: "Formular aus Vorlage", group: "Aktionen", icon: <LayoutTemplate />, run: () => router.push("/vorlagen") },
          { id: "describe", label: "Formular aus Beschreibung", group: "Aktionen", icon: <Wand2 />, keywords: "ki generieren beschreiben", run: () => setDescribe(true) },
        ]
      : [],
  );

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        toast(msg);
        router.refresh();
      }
    });

  const menuItems = (f: Row, Item: typeof MenuItem | typeof ContextMenuItem, Sep: () => React.ReactNode) => (
    <>
      <Item onSelect={() => router.push(`/formulare/${f.id}/bearbeiten`)}><Pencil /> Bearbeiten</Item>
      <Item onSelect={() => router.push(`/formulare/${f.id}/antworten`)}><Inbox /> Antworten</Item>
      {f.status === "published" && <Item onSelect={() => window.open(`/f/${f.slug}`, "_blank", "noopener")}><ExternalLink /> Öffentlich ansehen</Item>}
      {canWrite && (
        <>
          <Sep />
          <Item onSelect={() => start(async () => {
            const r = await duplicateFormAction(f.id);
            if (!r.ok) return void toast.error(r.error);
            toast("Formular dupliziert");
            router.push(`/formulare/${r.data.id}/bearbeiten`);
          })}><Copy /> Duplizieren</Item>
          {f.status === "published" && <Item onSelect={() => act(() => setStatusAction(f.id, "paused"), "Formular pausiert")}><Pause /> Pausieren</Item>}
          {f.status === "paused" && <Item onSelect={() => act(() => setStatusAction(f.id, "published"), "Formular wieder geöffnet")}><Play /> Wieder öffnen</Item>}
          {f.status !== "archived" ? (
            <Item onSelect={() => act(() => setStatusAction(f.id, "archived"), "Formular archiviert")}><Archive /> Archivieren</Item>
          ) : (
            <Item onSelect={() => act(() => setStatusAction(f.id, "draft"), "Formular wiederhergestellt")}><Archive /> Aus dem Archiv holen</Item>
          )}
        </>
      )}
      {canDelete && (
        <>
          <Sep />
          <Item danger onSelect={() => setConfirmDelete(f)}><Trash2 /> Löschen …</Item>
        </>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Formulare"
        description={forms.length ? `${forms.filter((f) => f.status === "published").length} veröffentlicht · ${forms.reduce((s, f) => s + f.submissions, 0)} Antworten insgesamt` : undefined}
        actions={
          canWrite && (
            <>
              <Button asChild variant="secondary"><Link href="/vorlagen"><LayoutTemplate /> Vorlagen</Link></Button>
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="primary" loading={pending}><Plus /> Neues Formular <ChevronDown className="-mr-1 opacity-70" /></Button>
                </MenuTrigger>
                <MenuContent className="w-60">
                  <MenuItem onSelect={() => create()}><Plus /> Leeres Formular</MenuItem>
                  <MenuItem onSelect={() => router.push("/vorlagen")}><LayoutTemplate /> Aus Vorlage</MenuItem>
                  <MenuItem onSelect={() => setDescribe(true)}><Wand2 /> Aus Beschreibung …</MenuItem>
                </MenuContent>
              </Menu>
            </>
          )
        }
      />

      {forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-paper/50">
          <Empty
            icon={<FileStack />}
            title="Noch keine Formulare"
            action={canWrite && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => create()}><Plus /> Leeres Formular</Button>
                <Button asChild><Link href="/vorlagen"><LayoutTemplate /> Mit Vorlage beginnen</Link></Button>
                <Button onClick={() => setDescribe(true)}><Wand2 /> Beschreiben</Button>
              </div>
            )}
          >
            Ein Kontaktformular ist in zwei Minuten veröffentlicht. Fang leer an oder nimm eine der zehn Vorlagen.
          </Empty>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Formular suchen" aria-label="Formular suchen" className="h-8 w-full rounded-md border border-line bg-paper pl-8 pr-2 text-[13.5px] placeholder:text-faint focus:border-stamp focus:outline-none" />
            </div>
            <Segmented label="Filter" size="sm" value={filter} onChange={setFilter} options={[{ value: "active", label: "Aktiv" }, { value: "archived", label: "Archiv" }]} />
          </div>
          <ul className="overflow-hidden rounded-lg bg-paper shadow-sheet">
            {shown.map((f) => (
              <ContextMenu key={f.id}>
                <ContextMenuTrigger asChild>
                  <li className="group relative flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-paper-2 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/formulare/${f.id}/bearbeiten`} className="block truncate font-display text-[17px] font-[480] leading-snug after:absolute after:inset-0 focus-visible:outline-none">
                        {f.title || "Unbenanntes Formular"}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                        <FormStatusBadge status={f.status} />
                        <span>{MODE[f.mode]}</span>
                        <span className="font-mono text-[11.5px] text-faint max-sm:hidden">/f/{f.slug}</span>
                        <span className="max-sm:hidden">geändert <TimeAgo at={f.updatedAt} /></span>
                      </div>
                    </div>
                    <Link href={`/formulare/${f.id}/antworten`} className="relative z-10 hidden min-w-28 text-right sm:block">
                      <div className="text-[14px] font-medium tabular">
                        {f.submissions} {f.submissions === 1 ? "Antwort" : "Antworten"}
                      </div>
                      <div className={cn("text-[12px]", f.newCount ? "text-stamp" : "text-faint")}>{f.newCount ? `${f.newCount} neu` : f.lastSubmissionAt ? <TimeAgo at={f.lastSubmissionAt} prefix="zuletzt " /> : "noch keine"}</div>
                    </Link>
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" className="relative z-10" aria-label={`Aktionen für ${f.title}`}><MoreHorizontal /></Button>
                      </MenuTrigger>
                      <MenuContent>{menuItems(f, MenuItem, MenuSeparator)}</MenuContent>
                    </Menu>
                  </li>
                </ContextMenuTrigger>
                <ContextMenuContent>{menuItems(f, ContextMenuItem as typeof MenuItem, ContextMenuSeparator)}</ContextMenuContent>
              </ContextMenu>
            ))}
            {shown.length === 0 && <li className="px-5 py-10 text-center text-[13.5px] text-muted">{q ? `Kein Formular passt zu „${q}“.` : "Das Archiv ist leer."}</li>}
          </ul>
        </>
      )}

      <DescribeDialog open={describe} onOpenChange={setDescribe} />

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent title="Formular löschen?" description={confirmDelete ? `„${confirmDelete.title}“ verschwindet aus der Liste und der öffentliche Link funktioniert nicht mehr. ${confirmDelete.submissions ? `Die ${confirmDelete.submissions} Antworten werden nach der Aufbewahrungsfrist entfernt.` : ""}` : ""}>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => {
              const f = confirmDelete!;
              setConfirmDelete(null);
              act(() => deleteFormAction(f.id), "Formular gelöscht");
            }}>Löschen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
