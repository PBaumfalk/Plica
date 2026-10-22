"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { Bookmark, Columns3, Download, FileSpreadsheet, FileJson, FileText, Filter, Inbox, Search, Share2, Star, Tag, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useCommands } from "@/components/app/command-palette";
import { Button } from "@/components/ui/button";
import { Checkbox, Select, Switch } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/misc";
import { Dialog, DialogContent, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/time";
import { changeTagsAction, deleteSubmissionsAction, deleteViewAction, saveViewAction, setStarredAction, setSubmissionStatusAction } from "@/server/actions/submissions";
import { STATUS_META, STATUS_ORDER, StatusChip } from "./status";
import type { ResponsesData } from "./types";
import { qs, useQueryNav } from "./use-query";

/* ---------- Spaltenwahl (pro Formular im Browser gemerkt) ---------- */
export function useVisibleColumns(formId: string, columns: ResponsesData["columns"]) {
  const defaults = useMemo(() => columns.filter((c) => !["long_text", "signature", "matrix", "group", "hidden"].includes(c.type)).slice(0, 4).map((c) => c.fieldId), [columns]);
  const [visible, setVisible] = useState<string[]>(defaults);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`plica-cols-${formId}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setVisible((JSON.parse(raw) as string[]).filter((id) => columns.some((c) => c.fieldId === id)));
    } catch {}
  }, [formId, columns]);
  const update = (ids: string[]) => {
    setVisible(ids);
    try {
      localStorage.setItem(`plica-cols-${formId}`, JSON.stringify(ids));
    } catch {}
  };
  return [visible, update] as const;
}

/** Was in Listen als „Titel“ einer Antwort taugt: Name, E-Mail oder erste Antwort. */
export function primaryText(row: ResponsesData["rows"][number], columns: ResponsesData["columns"]) {
  const name = columns.find((c) => c.type === "name" && row.cells[c.fieldId]);
  if (name) return row.cells[name.fieldId];
  if (row.email) return row.email;
  const first = columns.find((c) => row.cells[c.fieldId] && c.type !== "consent");
  return first ? row.cells[first.fieldId] : "Ohne Angaben";
}

export function ResponsesView({ data }: { data: ResponsesData }) {
  const router = useRouter();
  const { form, columns, rows, query } = data;
  const nav = useQueryNav(query);
  const [visible, setVisible] = useVisibleColumns(form.id, columns);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const [, start] = useTransition();
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const shownCols = columns.filter((c) => visible.includes(c.fieldId));
  const filtered = Object.keys(query).some((k) => k !== "sort" && k !== "page");
  const totalAll = Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0);

  // Auswahl bereinigen, wenn sich die Liste ändert
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((s) => new Set([...s].filter((id) => rows.some((r) => r.id === id))));
  }, [rows]);

  const open = useCallback((id: string) => router.push(`/formulare/${form.id}/antworten/${id}${qs(query)}`), [router, form.id, query]);

  // Tastatur: j/k bewegen, Enter öffnen, x auswählen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!rows.length) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, rows.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && t.tagName !== "BUTTON" && t.tagName !== "A") {
        e.preventDefault();
        open(rows[active].id);
      } else if (e.key === "x") {
        const id = rows[active].id;
        setSelected((s) => {
          const n = new Set(s);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        });
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("resp-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, active, open]);

  useEffect(() => {
    tableRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const exportHref = (format: string, ids?: string[]) => `/api/forms/${form.id}/export?${new URLSearchParams({ ...query, format, ...(ids ? { ids: ids.join(",") } : {}) }).toString()}`;

  useCommands("responses", [
    ...(data.can.export ? [
      { id: "export-csv", label: "Antworten als CSV exportieren", group: "Antworten", icon: <FileText />, run: () => (window.location.href = exportHref("csv")) },
      { id: "export-xlsx", label: "Antworten als Excel exportieren", group: "Antworten", icon: <FileSpreadsheet />, run: () => (window.location.href = exportHref("xlsx")) },
    ] : []),
    { id: "filter-new", label: "Nur neue Antworten zeigen", group: "Antworten", icon: <Inbox />, run: () => nav.set({ status: "new" }) },
    { id: "filter-reset", label: "Filter zurücksetzen", group: "Antworten", icon: <X />, run: () => nav.replaceAll({}) },
  ]);

  const bulk = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast(msg);
      router.refresh();
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  if (totalAll === 0 && !filtered) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong bg-paper/50">
        <Empty
          icon={<Inbox />}
          title="Noch keine Antworten"
          action={
            data.can.share && (
              <Button asChild variant="primary">
                <Link href={`/formulare/${form.id}/teilen`}>
                  <Share2 /> Formular teilen
                </Link>
              </Button>
            )
          }
        >
          {form.published ? "Sobald jemand das Formular absendet, erscheint die Antwort hier – mit Status, Notizen und PDF." : "Veröffentliche das Formular und teile den Link. Antworten erscheinen dann hier."}
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Toolbar data={data} nav={nav} visible={visible} setVisible={setVisible} exportHref={exportHref} />

      <div className={cn("overflow-hidden rounded-lg bg-paper shadow-sheet transition-opacity", nav.pending && "opacity-60")}>
        {rows.length === 0 ? (
          <Empty icon={<Search />} title="Keine Treffer" action={<Button onClick={() => nav.replaceAll({})}>Filter zurücksetzen</Button>}>
            Keine Antwort passt zu den aktuellen Filtern.
          </Empty>
        ) : (
          <>
            {/* Tabelle ab Tablet */}
            <div className="max-h-[calc(100dvh-300px)] overflow-auto max-md:hidden">
              <table className="w-full border-separate border-spacing-0 text-[13.5px]">
                <thead className="sticky top-0 z-10 bg-paper-2 text-left text-[12px] font-medium text-muted">
                  <tr>
                    <th className="w-10 border-b border-line py-2 pl-4">
                      <Checkbox label="Alle auswählen" checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />
                    </th>
                    <th className="w-14 border-b border-line py-2 pr-2 font-medium">Nr.</th>
                    <th className="w-8 border-b border-line py-2" aria-label="Markiert" />
                    <th className="w-32 border-b border-line py-2 pr-3 font-medium">Status</th>
                    {shownCols.map((c) => (
                      <th key={c.fieldId} className="max-w-56 border-b border-line py-2 pr-4 font-medium">
                        <span className="line-clamp-1">{c.label}</span>
                      </th>
                    ))}
                    <th className="border-b border-line py-2 pr-4 font-medium">Tags</th>
                    <th className="w-36 border-b border-line py-2 pr-4 text-right font-medium">
                      <button className="hover:text-ink" onClick={() => nav.set({ sort: query.sort === "oldest" ? null : "oldest" })}>
                        Eingang {query.sort === "oldest" ? "↑" : "↓"}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody ref={tableRef}>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      data-row={i}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a, [role=checkbox]")) return;
                        open(r.id);
                      }}
                      className={cn("group cursor-pointer", i === active ? "bg-stamp-soft/50" : "hover:bg-paper-2", selected.has(r.id) && "bg-stamp-soft/70")}
                    >
                      <td className="border-b border-line py-2.5 pl-4">
                        <Checkbox
                          label={`Antwort ${r.number} auswählen`}
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (v) n.add(r.id);
                              else n.delete(r.id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="border-b border-line py-2.5 pr-2 font-mono text-[12px] text-muted tabular">
                        <Link href={`/formulare/${form.id}/antworten/${r.id}${qs(query)}`} className="hover:text-ink focus-visible:outline-2" onFocus={() => setActive(i)}>
                          #{r.number}
                        </Link>
                      </td>
                      <td className="border-b border-line py-2.5">
                        <StarButton starred={r.starred} disabled={!data.can.update} onToggle={() => bulk(() => setStarredAction(form.id, [r.id], !r.starred), r.starred ? "Markierung entfernt" : "Markiert")} />
                      </td>
                      <td className="border-b border-line py-2.5 pr-3">
                        <StatusChip status={r.status} />
                      </td>
                      {shownCols.map((c) => (
                        <td key={c.fieldId} className={cn("max-w-56 border-b border-line py-2.5 pr-4", !r.cells[c.fieldId] && "text-faint")}>
                          <span className="line-clamp-1 break-all">{r.cells[c.fieldId] || "–"}</span>
                        </td>
                      ))}
                      <td className="border-b border-line py-2.5 pr-4">
                        <div className="flex max-w-48 flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <span key={t} className="rounded-xs bg-desk-2 px-1.5 text-[11.5px] text-ink-2">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="border-b border-line py-2.5 pr-4 text-right whitespace-nowrap text-muted" title={dateTime(r.submittedAt)}>
                        <TimeAgo at={r.submittedAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Karten auf dem Telefon */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/formulare/${form.id}/antworten/${r.id}${qs(query)}`} className="flex items-start gap-3 px-4 py-3 active:bg-paper-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-muted">#{r.number}</span>
                        <StatusChip status={r.status} />
                        {r.starred && <Star className="size-3.5 fill-warn text-warn" />}
                      </div>
                      <div className="mt-1 truncate text-[14.5px] font-medium">{primaryText(r, columns)}</div>
                    </div>
                    <span className="shrink-0 text-[12px] text-muted"><TimeAgo at={r.submittedAt} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[12.5px] text-muted">
        <span>
          {data.total === 1 ? "1 Antwort" : `${data.total} Antworten`}
          {filtered ? " gefunden" : ""}
          <span className="ml-3 hidden items-center gap-1 lg:inline-flex">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> bewegen · <Kbd>↵</Kbd> öffnen · <Kbd>x</Kbd> auswählen · <Kbd>/</Kbd> suchen
          </span>
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="ghost" aria-label="Vorherige Seite" disabled={data.page <= 1} onClick={() => nav.set({ page: String(data.page - 1) })}>
              <ChevronLeft />
            </Button>
            <span className="tabular">
              Seite {data.page} von {pages}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Nächste Seite" disabled={data.page >= pages} onClick={() => nav.set({ page: String(data.page + 1) })}>
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>

      {selected.size > 0 && <BulkBar data={data} ids={[...selected]} clear={() => setSelected(new Set())} bulk={bulk} exportHref={exportHref} />}
    </div>
  );
}

export function StarButton({ starred, onToggle, disabled }: { starred: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onToggle} aria-pressed={starred} aria-label={starred ? "Markierung entfernen" : "Markieren"} className={cn("grid size-6 place-items-center rounded-sm transition-colors disabled:cursor-default", starred ? "text-warn" : "text-line-strong hover:text-muted group-hover:text-faint")}>
      <Star className={cn("size-4", starred && "fill-current")} />
    </button>
  );
}

/* ---------------- Werkzeugleiste ---------------- */

function Toolbar({ data, nav, visible, setVisible, exportHref }: { data: ResponsesData; nav: ReturnType<typeof useQueryNav>; visible: string[]; setVisible: (v: string[]) => void; exportHref: (f: string) => string }) {
  const { query, columns, counts } = data;
  const [q, setQ] = useState(query.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ(query.q ?? "");
  }, [query.q]);
  const activeStatus = query.status?.split(",") ?? [];
  const activeFilters = ["tags", "starred", "from", "to", "ff"].filter((k) => query[k]).length;
  const activeCount = Object.entries(counts).filter(([k]) => k !== "spam").reduce((s, [, n]) => s + (n ?? 0), 0);

  return (
    <div className="space-y-3">
      <Views data={data} nav={nav} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            id="resp-search"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => nav.set({ q: v.trim() || null }), 300);
            }}
            placeholder="Antworten durchsuchen"
            aria-label="Antworten durchsuchen"
            className="h-8 w-full rounded-md border border-line bg-paper pl-8 pr-8 text-[13.5px] placeholder:text-faint focus:border-stamp focus:outline-none focus:ring-3 focus:ring-stamp/15"
          />
          {q && (
            <button aria-label="Suche leeren" onClick={() => (setQ(""), nav.set({ q: null }))} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-1">
          <FilterChip active={!activeStatus.length} onClick={() => nav.set({ status: null })}>
            Alle <span className="tabular text-faint">{activeCount}</span>
          </FilterChip>
          {STATUS_ORDER.filter((s) => counts[s] || activeStatus.includes(s)).map((s) => (
            <FilterChip key={s} active={activeStatus.includes(s)} onClick={() => nav.set({ status: activeStatus.includes(s) ? activeStatus.filter((x) => x !== s).join(",") || null : [...activeStatus, s].join(",") })}>
              <span className={cn("size-1.5 rounded-full", STATUS_META[s].dot)} />
              {STATUS_META[s].label} <span className="tabular text-faint">{counts[s] ?? 0}</span>
            </FilterChip>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <FilterPopover data={data} nav={nav} count={activeFilters} />
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="max-md:hidden">
                <Columns3 /> Spalten
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1.5">
              <div className="px-2 pb-1.5 pt-1 text-[12px] text-muted">Spalten in der Tabelle</div>
              <div className="max-h-80 overflow-y-auto">
                {columns.map((c) => (
                  <label key={c.fieldId} className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13.5px] hover:bg-desk-2">
                    <Checkbox checked={visible.includes(c.fieldId)} onCheckedChange={(on) => setVisible(on ? columns.map((x) => x.fieldId).filter((id) => id === c.fieldId || visible.includes(id)) : visible.filter((id) => id !== c.fieldId))} />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {data.can.export && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Download /> Export
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>{data.total} {data.total === 1 ? "Antwort" : "Antworten"} mit aktuellen Filtern</MenuLabel>
                <MenuItem asChild>
                  <a href={exportHref("xlsx")} download>
                    <FileSpreadsheet /> Excel (XLSX)
                  </a>
                </MenuItem>
                <MenuItem asChild>
                  <a href={exportHref("csv")} download>
                    <FileText /> CSV für Excel
                  </a>
                </MenuItem>
                <MenuItem asChild>
                  <a href={exportHref("json")} download>
                    <FileJson /> JSON
                  </a>
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", active ? "border-stamp-line bg-stamp-soft font-medium text-stamp" : "border-line bg-paper text-ink-2 hover:border-line-strong")}>
      {children}
    </button>
  );
}

const OPS = [
  { value: "contains", label: "enthält" },
  { value: "eq", label: "ist genau" },
  { value: "gt", label: "größer / nach" },
  { value: "lt", label: "kleiner / vor" },
  { value: "not_empty", label: "ist ausgefüllt" },
  { value: "empty", label: "ist leer" },
];

function FilterPopover({ data, nav, count }: { data: ResponsesData; nav: ReturnType<typeof useQueryNav>; count: number }) {
  const { query } = data;
  const [f, setF] = useState({ tags: query.tags ?? "", starred: query.starred === "1", from: query.from ?? "", to: query.to ?? "", ff: query.ff ?? "", fop: query.fop ?? "contains", fv: query.fv ?? "", sort: query.sort ?? "newest" });
  const [openState, setOpen] = useState(false);
  const field = data.columns.find((c) => c.fieldId === f.ff);
  const tagList = f.tags.split(",").filter(Boolean);
  const apply = () => {
    nav.set({ tags: f.tags || null, starred: f.starred ? "1" : null, from: f.from || null, to: f.to || null, ff: f.ff || null, fop: f.ff ? f.fop : null, fv: f.ff && ["contains", "eq", "gt", "lt"].includes(f.fop) ? f.fv || null : null, sort: f.sort === "newest" ? null : f.sort });
    setOpen(false);
  };
  return (
    <Popover open={openState} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={count ? "subtle" : "ghost"}>
          <Filter /> Filter{count ? ` · ${count}` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))] space-y-4 p-4">
        <div className="space-y-1.5">
          <div className="text-[12.5px] font-medium text-ink-2">Antwort auf eine Frage</div>
          <Select label="Frage" value={f.ff || undefined} onValueChange={(v) => setF({ ...f, ff: v })} placeholder="Frage wählen" options={data.columns.map((c) => ({ value: c.fieldId, label: c.label }))} />
          {f.ff && (
            <div className="flex gap-2">
              <div className="w-36 shrink-0">
                <Select label="Bedingung" value={f.fop} onValueChange={(v) => setF({ ...f, fop: v })} options={OPS} />
              </div>
              {["contains", "eq", "gt", "lt"].includes(f.fop) &&
                (field?.options?.length && f.fop === "eq" ? (
                  <Select label="Wert" value={f.fv || undefined} onValueChange={(v) => setF({ ...f, fv: v })} placeholder="Wert" options={field.options.map((o) => ({ value: o.value, label: o.label }))} />
                ) : (
                  <Input aria-label="Wert" value={f.fv} onChange={(e) => setF({ ...f, fv: e.target.value })} placeholder="Wert" className="h-9" />
                ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5 text-[12.5px] font-medium text-ink-2">
            Von
            <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </label>
          <label className="space-y-1.5 text-[12.5px] font-medium text-ink-2">
            Bis
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </label>
        </div>
        {data.tags.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[12.5px] font-medium text-ink-2">Tags (alle müssen passen)</div>
            <div className="flex flex-wrap gap-1">
              {data.tags.map((t) => (
                <FilterChip key={t} active={tagList.includes(t)} onClick={() => setF({ ...f, tags: (tagList.includes(t) ? tagList.filter((x) => x !== t) : [...tagList, t]).join(",") })}>
                  {t}
                </FilterChip>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center justify-between text-[13.5px]">
          Nur markierte
          <Switch checked={f.starred} onCheckedChange={(v) => setF({ ...f, starred: v })} />
        </label>
        <div className="space-y-1.5">
          <div className="text-[12.5px] font-medium text-ink-2">Sortierung</div>
          <Select label="Sortierung" value={f.sort} onValueChange={(v) => setF({ ...f, sort: v })} options={[{ value: "newest", label: "Neueste zuerst" }, { value: "oldest", label: "Älteste zuerst" }, { value: "number_desc", label: "Nummer absteigend" }, { value: "number_asc", label: "Nummer aufsteigend" }]} />
        </div>
        <div className="flex justify-between gap-2 border-t border-line pt-3">
          <Button size="sm" variant="ghost" onClick={() => setF({ tags: "", starred: false, from: "", to: "", ff: "", fop: "contains", fv: "", sort: "newest" })}>
            Zurücksetzen
          </Button>
          <Button size="sm" variant="primary" onClick={apply}>
            Anwenden
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Gespeicherte Ansichten ---------------- */

function sameQuery(a: Record<string, string>, b: Record<string, string>) {
  const clean = (o: Record<string, string>) => JSON.stringify(Object.entries(o).filter(([k]) => k !== "page").sort());
  return clean(a) === clean(b);
}

function Views({ data, nav }: { data: ResponsesData; nav: ReturnType<typeof useQueryNav> }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, start] = useTransition();
  const current = data.views.find((v) => sameQuery(v.query, data.query));
  const unsaved = !current && Object.keys(data.query).some((k) => k !== "page");
  if (!data.views.length && !unsaved) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Bookmark className="mr-1 size-3.5 text-faint" />
      <FilterChip active={!Object.keys(data.query).length} onClick={() => nav.replaceAll({})}>
        Alle Antworten
      </FilterChip>
      {data.views.map((v) => (
        <Menu key={v.id}>
          <div className="inline-flex items-center">
            <FilterChip active={current?.id === v.id} onClick={() => nav.replaceAll(v.query)}>
              {v.name}
              {v.shared && <span className="text-[10.5px] text-faint">geteilt</span>}
            </FilterChip>
            {v.mine && (
              <MenuTrigger className="ml-0.5 rounded-sm px-0.5 text-faint hover:text-ink" aria-label={`Ansicht ${v.name} verwalten`}>
                ⋯
              </MenuTrigger>
            )}
          </div>
          <MenuContent align="start">
            <MenuItem
              danger
              onSelect={() =>
                start(async () => {
                  const r = await deleteViewAction(data.form.id, v.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast("Ansicht gelöscht");
                  router.refresh();
                })
              }
            >
              <Trash2 /> Ansicht löschen
            </MenuItem>
          </MenuContent>
        </Menu>
      ))}
      {unsaved && (
        <button type="button" onClick={() => setDialog(true)} className="ml-1 text-[12.5px] font-medium text-stamp hover:underline">
          + Ansicht speichern
        </button>
      )}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent title="Ansicht speichern" description="Speichert Suche, Filter und Sortierung unter einem Namen.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveViewAction(data.form.id, name, Object.fromEntries(Object.entries(data.query).filter(([k]) => k !== "page")), shared);
                if (!r.ok) return void toast.error(r.error);
                setDialog(false);
                setName("");
                toast(`Ansicht „${name}“ gespeichert`);
                router.refresh();
              });
            }}
          >
            <Input autoFocus aria-label="Name der Ansicht" placeholder="z. B. Offene Unternehmensanfragen" value={name} onChange={(e) => setName(e.target.value)} />
            {data.can.update && (
              <label className="flex items-center justify-between text-[13.5px]">
                Für alle im Workspace sichtbar
                <Switch checked={shared} onCheckedChange={setShared} />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setDialog(false)}>Abbrechen</Button>
              <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Sammelaktionen ---------------- */

function BulkBar({ data, ids, clear, bulk, exportHref }: { data: ResponsesData; ids: string[]; clear: () => void; bulk: (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void; exportHref: (f: string, ids?: string[]) => string }) {
  const [tag, setTag] = useState("");
  const [confirm, setConfirm] = useState(false);
  const n = ids.length;
  return (
    <div role="region" aria-label="Sammelaktionen" className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-fit flex-wrap items-center gap-1 rounded-lg bg-ink p-1.5 pl-3 text-paper shadow-pop animate-pop-in">
      <span className="mr-2 text-[13px] font-medium tabular">{n} ausgewählt</span>
      {data.can.update && (
        <>
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost" className="text-paper hover:bg-white/10 hover:text-paper">Status</Button>
            </MenuTrigger>
            <MenuContent side="top" align="start">
              {STATUS_ORDER.map((s) => (
                <MenuItem key={s} onSelect={() => (bulk(() => setSubmissionStatusAction(data.form.id, ids, s), `${n} auf „${STATUS_META[s].label}“ gesetzt`), clear())}>
                  <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="text-paper hover:bg-white/10 hover:text-paper"><Tag /> Tag</Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!tag.trim()) return;
                  bulk(() => changeTagsAction(data.form.id, ids, [tag.trim()], []), `Tag „${tag.trim()}“ hinzugefügt`);
                  setTag("");
                }}
                className="flex gap-2"
              >
                <Input autoFocus aria-label="Tag" list="bulk-tags" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag hinzufügen" className="h-8" />
                <datalist id="bulk-tags">{data.tags.map((t) => <option key={t} value={t} />)}</datalist>
                <Button size="sm" type="submit" variant="primary">OK</Button>
              </form>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="ghost" className="text-paper hover:bg-white/10 hover:text-paper" onClick={() => (bulk(() => setStarredAction(data.form.id, ids, true), "Markiert"), clear())}>
            <Star /> Markieren
          </Button>
        </>
      )}
      {data.can.export && (
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost" className="text-paper hover:bg-white/10 hover:text-paper"><Download /> Export</Button>
          </MenuTrigger>
          <MenuContent side="top">
            <MenuItem asChild><a href={exportHref("xlsx", ids)} download><FileSpreadsheet /> Excel (XLSX)</a></MenuItem>
            <MenuItem asChild><a href={exportHref("csv", ids)} download><FileText /> CSV</a></MenuItem>
            <MenuItem asChild><a href={exportHref("json", ids)} download><FileJson /> JSON</a></MenuItem>
          </MenuContent>
        </Menu>
      )}
      {data.can.delete && (
        <Button size="sm" variant="ghost" className="text-[#ff9b94] hover:bg-white/10 hover:text-[#ffb3ad]" onClick={() => setConfirm(true)}>
          <Trash2 /> Löschen
        </Button>
      )}
      <span aria-hidden className="mx-1 h-5 w-px bg-white/20" />
      <Button size="icon-sm" variant="ghost" aria-label="Auswahl aufheben" className="text-paper hover:bg-white/10 hover:text-paper" onClick={clear}>
        <X />
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={`${n} ${n === 1 ? "Antwort" : "Antworten"} endgültig löschen?`} description="Die Antworten und alle zugehörigen Dateien und Unterschriften werden unwiderruflich entfernt. Der Vorgang wird im Audit-Log festgehalten.">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                bulk(() => deleteSubmissionsAction(data.form.id, ids), `${n} gelöscht`);
                clear();
              }}
            >
              Endgültig löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
