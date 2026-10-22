"use client";
import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle, Blocks, GitBranch, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Segmented } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { CATEGORY_LABELS, FIELD_META, type Category } from "@/lib/forms/fields";
import type { FieldType } from "@/lib/forms/schema";
import { deleteBlockAction, type BlockSummary } from "@/server/actions/blocks";
import { useBuilder } from "./context";
import { FieldIcon } from "./field-icons";
import { selectedFieldIds } from "./store";

const ORDER: Category[] = ["text", "contact", "choice", "number", "date", "media", "advanced", "layout"];

export function Palette({ onPicked }: { onPicked?: () => void }) {
  const [tab, setTab] = useState<"insert" | "outline">("insert");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pt-3">
        <Segmented label="Linke Spalte" size="sm" value={tab} onChange={setTab} options={[{ value: "insert", label: "Einfügen" }, { value: "outline", label: "Gliederung" }]} />
      </div>
      {tab === "insert" ? <Insert onPicked={onPicked} /> : <Outline onPicked={onPicked} />}
    </div>
  );
}

function Insert({ onPicked }: { onPicked?: () => void }) {
  const { insertType, insertBlock, blocks } = useBuilder();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const types = (Object.keys(FIELD_META) as FieldType[]).filter((t) => !term || `${FIELD_META[t].label} ${FIELD_META[t].keywords} ${FIELD_META[t].hint}`.toLowerCase().includes(term));
  const shownBlocks = blocks.filter((b) => !term || b.name.toLowerCase().includes(term));
  const pick = (fn: () => void) => () => {
    fn();
    onPicked?.();
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative px-3 pb-2 pt-3">
        <Search className="pointer-events-none absolute left-5.5 top-1/2 mt-0.5 size-3.5 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Feldtyp suchen" aria-label="Feldtyp suchen" className="h-8 w-full rounded-md border border-line bg-paper pl-7.5 pr-2 text-[13px] placeholder:text-faint focus:border-stamp focus:outline-none" />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-6 pt-1">
        {ORDER.map((cat) => {
          const list = types.filter((t) => FIELD_META[t].category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} aria-label={CATEGORY_LABELS[cat]}>
              <h3 className="mb-1 px-1 text-[11.5px] font-medium uppercase tracking-wider text-faint">{CATEGORY_LABELS[cat]}</h3>
              <ul className="grid grid-cols-2 gap-1">
                {list.map((t) => (
                  <li key={t}>
                    <PaletteItem type={t} onPick={pick(() => insertType(t))} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {(shownBlocks.length > 0 || !term) && (
          <section aria-label="Bausteine">
            <h3 className="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] font-medium uppercase tracking-wider text-faint">
              <Blocks className="size-3" /> Bausteine
            </h3>
            {shownBlocks.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-2.5 py-2.5 text-[12.5px] leading-snug text-muted">
                Markiere Felder und wähle im Inspektor „Als Baustein speichern“, um sie in jedem Formular wiederzuverwenden.
              </p>
            ) : (
              <ul className="space-y-1">
                {shownBlocks.map((b) => (
                  <li key={b.id}>
                    <BlockItem block={b} onPick={pick(() => insertBlock(b))} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {term && types.length === 0 && shownBlocks.length === 0 && <p className="px-1 text-[13px] text-muted">Kein Feldtyp passt zu „{q}“.</p>}
      </div>
    </div>
  );
}

function PaletteItem({ type, onPick }: { type: FieldType; onPick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal:${type}`, data: { kind: "palette", type } });
  const meta = FIELD_META[type];
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onPick}
      title={`${meta.label} – ${meta.hint}. Klicken zum Einfügen oder ziehen.`}
      className={cn("flex min-h-8 w-full cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12.5px] leading-tight text-ink-2 transition-colors hover:bg-paper hover:text-ink hover:shadow-[0_1px_2px_rgb(0_0_0/0.06)] active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <FieldIcon type={type} className="size-3.5 shrink-0 text-muted" />
      <span className="min-w-0">{meta.label}</span>
    </button>
  );
}

function BlockItem({ block, onPick }: { block: BlockSummary; onPick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `blk:${block.id}`, data: { kind: "block", block } });
  const { blocks, setBlocks } = useBuilder();
  const [, start] = useTransition();
  return (
    <div className={cn("group flex items-center rounded-md border border-line bg-paper pr-1 hover:border-line-strong", isDragging && "opacity-40")}>
      <button ref={setNodeRef} type="button" {...listeners} {...attributes} onClick={onPick} className="flex min-w-0 flex-1 cursor-grab items-center gap-2 px-2.5 py-1.5 text-left active:cursor-grabbing">
        <Blocks className="size-3.5 shrink-0 text-stamp" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{block.name}</span>
          <span className="block truncate text-[11.5px] text-muted">{block.fields.length} {block.fields.length === 1 ? "Feld" : "Felder"}</span>
        </span>
      </button>
      <Menu>
        <MenuTrigger className="rounded-sm p-1 text-faint opacity-0 hover:bg-desk-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Aktionen für Baustein ${block.name}`}>
          <MoreHorizontal className="size-4" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            danger
            onSelect={() =>
              start(async () => {
                const r = await deleteBlockAction(block.id);
                if (!r.ok) return void toast.error(r.error);
                setBlocks(blocks.filter((b) => b.id !== block.id));
                toast("Baustein gelöscht");
              })
            }
          >
            <Trash2 /> Baustein löschen
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function Outline({ onPicked }: { onPicked?: () => void }) {
  const { state, api, marks, issuesByTarget, setPanel } = useBuilder();
  const selected = new Set(selectedFieldIds(state.selection));
  const go = (id: string) => {
    api.select({ kind: "fields", ids: [id] });
    setPanel("field");
    onPicked?.();
    requestAnimationFrame(() => document.getElementById(`fb-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const row = (id: string, type: FieldType, label: string, depth: number) => (
    <li key={id}>
      <button type="button" onClick={() => go(id)} aria-current={selected.has(id) || undefined} className={cn("flex h-7 w-full items-center gap-2 rounded-sm pr-2 text-left text-[13px] hover:bg-paper", selected.has(id) ? "bg-paper font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-ink-2")} style={{ paddingLeft: 8 + depth * 14 }}>
        <FieldIcon type={type} className="size-3.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate">{label || FIELD_META[type].label}</span>
        {marks.targets.has(id) && <GitBranch className="size-3 shrink-0 text-stamp" aria-label="bedingt" />}
        {issuesByTarget.get(id) && <AlertTriangle className="size-3 shrink-0 text-warn" aria-label="Hinweis" />}
      </button>
    </li>
  );
  return (
    <nav aria-label="Gliederung" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
      {state.def.pages.map((p, i) => (
        <div key={p.id} className="mb-3">
          <button type="button" onClick={() => (api.select({ kind: "page", id: p.id }), onPicked?.())} className="mb-0.5 flex w-full items-center gap-2 px-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-faint hover:text-ink">
            Seite {i + 1}
            {p.title && <span className="truncate font-sans normal-case tracking-normal">· {p.title}</span>}
            {marks.targets.has(p.id) && <GitBranch className="size-3 text-stamp" />}
          </button>
          <ul>
            {p.fields.length === 0 && <li className="px-2 py-1 text-[12.5px] text-faint">leer</li>}
            {p.fields.flatMap((f) => [row(f.id, f.type, f.label, 0), ...(f.fields ?? []).map((c) => row(c.id, c.type, c.label, 1))])}
          </ul>
        </div>
      ))}
    </nav>
  );
}
