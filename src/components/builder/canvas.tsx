"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { AlertTriangle, ArrowDown, ArrowUp, Asterisk, ChevronDown, Copy, GitBranch, GripVertical, Group, MoreHorizontal, Plus, Sparkles, Trash2, Ungroup } from "lucide-react";
import { suggestFields } from "@/lib/forms/suggest";
import { memo, useMemo, type ReactNode } from "react";
import { FieldInput } from "@/components/form/field-input";
import { themeStyle } from "@/components/form/renderer";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { FIELD_META } from "@/lib/forms/fields";
import { isInputField, type Field, type FormDefinition, type Page } from "@/lib/forms/schema";
import { useBuilder } from "./context";
import { FieldIcon } from "./field-icons";
import { addPage, mergeWithPrevious, movePage, nudge, removePage, ungroup, type ContainerKey } from "./ops";
import { selectedFieldIds } from "./store";

export function Canvas() {
  const { state, device, api } = useBuilder();
  const def = state.def;
  return (
    <div className={cn("mx-auto px-3 pb-40 pt-8 transition-[max-width] duration-300 sm:px-6", device === "mobile" ? "max-w-[430px]" : "max-w-[780px]")} onClick={(e) => e.target === e.currentTarget && api.select(null)}>
      <div className="plica-form" style={themeStyle(def.settings.theme)}>
        {def.pages.map((p, i) => (
          <div key={p.id}>
            {i > 0 && <Crease def={def} pageIndex={i} />}
            <PageSheet page={p} index={i} />
          </div>
        ))}
        <AddPageButton />
      </div>
    </div>
  );
}

/** „Häufig ergänzt“ direkt unter dem Blatt – dort, wo der Blick nach dem Einfügen ist. */
function Suggestions() {
  const { state, insertType } = useBuilder();
  const suggestions = useMemo(() => suggestFields(state.def), [state.def]);
  if (!suggestions.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5" aria-label="Häufig ergänzt">
      <span className="inline-flex items-center gap-1 text-[12px] text-muted">
        <Sparkles className="size-3 text-stamp" /> Häufig ergänzt:
      </span>
      {suggestions.map((sg) => (
        <Tip key={sg.id} label={sg.reason}>
          <button type="button" onClick={() => insertType(sg.type, sg.overrides)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-stamp-line bg-paper px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-stamp hover:bg-stamp-soft hover:text-stamp">
            <Plus className="size-3" /> {sg.title}
          </button>
        </Tip>
      ))}
    </div>
  );
}

function AddPageButton() {
  const { api, state } = useBuilder();
  return (
    <>
    <Suggestions />
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        onClick={() =>
          api.mutate((d) => {
            const id = addPage(d, d.pages.length - 1);
            return { kind: "page", id };
          })
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-muted transition-colors hover:bg-desk-2 hover:text-ink"
      >
        <Plus className="size-3.5" /> Seite {state.def.pages.length + 1} anfügen
      </button>
    </div>
    </>
  );
}

/** Der Falz: sichtbarer Seitenumbruch zwischen zwei Blättern. */
function Crease({ def, pageIndex }: { def: FormDefinition; pageIndex: number }) {
  const { api } = useBuilder();
  const page = def.pages[pageIndex];
  return (
    <div className="group/crease relative my-1 flex h-10 items-center" role="separator" aria-label={`Seitenumbruch vor Seite ${pageIndex + 1}`}>
      <div className="plica-crease absolute inset-x-0 top-1/2 -translate-y-1/2" />
      <span className="relative mx-auto flex items-center gap-2 rounded-full bg-desk px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        Falz · Seite {pageIndex + 1}
        <button
          type="button"
          onClick={() => api.mutate((d) => void mergeWithPrevious(d, page.id))}
          className="rounded-full px-1.5 py-0.5 font-sans text-[11.5px] normal-case tracking-normal text-muted opacity-0 transition-opacity hover:bg-desk-2 hover:text-ink focus-visible:opacity-100 group-hover/crease:opacity-100"
        >
          Umbruch entfernen
        </button>
      </span>
    </div>
  );
}

function PageSheet({ page, index }: { page: Page; index: number }) {
  const { state, api, issuesByTarget, marks } = useBuilder();
  const def = state.def;
  const selected = state.selection?.kind === "page" && state.selection.id === page.id;
  const multi = def.pages.length > 1;
  const pageIssues = issuesByTarget.get(page.id);
  return (
    <section
      aria-label={`Seite ${index + 1}${page.title ? `: ${page.title}` : ""}`}
      className={cn("rounded-lg bg-[var(--f-field)] px-5 pb-6 pt-5 shadow-sheet transition-shadow sm:px-10 sm:pb-10 sm:pt-8", selected && "ring-2 ring-stamp/40")}
      onClick={(e) => {
        if (e.target === e.currentTarget) api.select({ kind: "page", id: page.id });
      }}
    >
      {index === 0 && <FormTitle />}
      {(multi || page.title) && (
        <div className="group/ph mb-5 flex items-start gap-2 border-b border-dashed border-line pb-3">
          <div className="min-w-0 flex-1" onClick={() => api.select({ kind: "page", id: page.id })}>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              Seite {index + 1}
              {marks.targets.has(page.id) && (
                <span className="inline-flex items-center gap-1 rounded-xs bg-stamp-soft px-1 py-px font-sans text-[11px] normal-case tracking-normal text-stamp">
                  <GitBranch className="size-3" /> bedingt
                </span>
              )}
              {pageIssues && <AlertTriangle className="size-3.5 text-warn" aria-label="Hinweis" />}
            </div>
            <input
              value={page.title}
              onChange={(e) => api.mutate((d) => void (d.pages[index].title = e.target.value), `page-title:${page.id}`)}
              onFocus={() => api.select({ kind: "page", id: page.id })}
              placeholder="Abschnittstitel (optional)"
              aria-label={`Titel von Seite ${index + 1}`}
              className="mt-1 w-full bg-transparent font-[family-name:var(--f-display)] text-[21px] font-[450] text-[var(--f-ink)] outline-none placeholder:text-faint"
            />
          </div>
          <PageMenu page={page} index={index} />
        </div>
      )}
      <FieldList fields={page.fields} container={`page:${page.id}`} />
      {page.fields.length === 0 ? <EmptyPage container={`page:${page.id}`} /> : <EndZone container={`page:${page.id}`} />}
    </section>
  );
}

function FormTitle() {
  const { state, api } = useBuilder();
  return (
    <div className="mb-8" onClick={() => api.select(null)}>
      <input
        value={state.def.title}
        onChange={(e) => api.mutate((d) => void (d.title = e.target.value), "title")}
        placeholder="Titel des Formulars"
        aria-label="Titel des Formulars"
        className="w-full bg-transparent font-[family-name:var(--f-display)] text-[clamp(26px,4vw,34px)] leading-tight font-[450] tracking-[-0.015em] text-[var(--f-ink)] outline-none placeholder:text-faint"
      />
      <textarea
        value={state.def.description ?? ""}
        onChange={(e) => api.mutate((d) => void (d.description = e.target.value || undefined), "description")}
        placeholder="Kurze Einleitung (optional) – was passiert mit den Angaben?"
        aria-label="Beschreibung des Formulars"
        rows={1}
        className="mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--f-muted)] outline-none [field-sizing:content] placeholder:text-faint"
      />
    </div>
  );
}

/** Leere Seite: Hinweis und zugleich Ablagezone – bleibt beim Ziehen stehen und leuchtet auf. */
function EmptyPage({ container }: { container: ContainerKey }) {
  const { openQuickInsert, dragging, openMobilePanel } = useBuilder();
  const { setNodeRef, isOver } = useDroppable({ id: `end:${container}`, data: { kind: "end", container } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center transition-colors",
        isOver ? "border-stamp bg-stamp-soft/60" : dragging ? "border-stamp-line bg-stamp-soft/25" : "border-line-strong",
      )}
    >
      {dragging ? (
        <p className={cn("text-[14px] font-medium", isOver ? "text-stamp" : "text-muted")}>Hier loslassen</p>
      ) : (
        <>
          <p className="text-[14px] text-muted">Ziehe Felder aus der linken Spalte hierher.</p>
          <p className="text-[13px] text-faint">
            Oder drücke <kbd className="rounded-xs border border-line bg-paper-2 px-1 font-mono text-[11px]">/</kbd> zum Einfügen.
          </p>
          <Button size="sm" className="mt-1 lg:hidden" onClick={() => openMobilePanel("palette")}>
            <Plus /> Feld einfügen
          </Button>
          <Button size="sm" variant="ghost" className="mt-1 max-lg:hidden" onClick={openQuickInsert}>
            <Plus /> Feld einfügen
          </Button>
        </>
      )}
    </div>
  );
}

function PageMenu({ page, index }: { page: Page; index: number }) {
  const { api, state } = useBuilder();
  const n = state.def.pages.length;
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Aktionen für Seite ${index + 1}`} className="opacity-60 group-hover/ph:opacity-100">
          <MoreHorizontal />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem disabled={index === 0} onSelect={() => api.mutate((d) => void movePage(d, page.id, -1))}><ArrowUp /> Seite nach oben</MenuItem>
        <MenuItem disabled={index === n - 1} onSelect={() => api.mutate((d) => void movePage(d, page.id, 1))}><ArrowDown /> Seite nach unten</MenuItem>
        <MenuItem onSelect={() => api.mutate((d) => ({ kind: "page", id: addPage(d, index) }))}><Plus /> Neue Seite danach</MenuItem>
        {index > 0 && <MenuItem onSelect={() => api.mutate((d) => void mergeWithPrevious(d, page.id))}><ChevronDown /> Mit vorheriger Seite zusammenführen</MenuItem>}
        <MenuSeparator />
        <MenuItem danger disabled={n <= 1} onSelect={() => api.mutate((d) => (removePage(d, page.id), null))}><Trash2 /> Seite mit Feldern löschen</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function Indicator() {
  return (
    <div className="relative h-0" aria-hidden>
      <div className="absolute -top-[5px] left-0 right-0 flex items-center">
        <span className="size-2 rounded-full border-2 border-stamp bg-paper" />
        <span className="h-0.5 flex-1 rounded-full bg-stamp" />
      </div>
    </div>
  );
}

function FieldList({ fields, container }: { fields: Field[]; container: ContainerKey }) {
  const { dropTarget } = useBuilder();
  const at = dropTarget?.container === container ? dropTarget.index : -1;
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      {fields.map((f, i) => (
        <div key={f.id} className={cn("relative", f.width !== "half" && "sm:col-span-2")}>
          {at === i && <Indicator />}
          <FieldBlock field={f} />
        </div>
      ))}
      {at === fields.length && fields.length > 0 && (
        <div className="sm:col-span-2">
          <Indicator />
        </div>
      )}
    </div>
  );
}

function EndZone({ container }: { container: ContainerKey }) {
  const { setNodeRef, isOver } = useDroppable({ id: `end:${container}`, data: { kind: "end", container } });
  const { dragging } = useBuilder();
  return <div ref={setNodeRef} className={cn("transition-all", dragging ? "min-h-12" : "min-h-2", isOver && "rounded-md bg-stamp-soft/60")} />;
}

const FieldBlock = memo(function FieldBlock({ field }: { field: Field }) {
  const b = useBuilder();
  const { state, api, issuesByTarget, marks } = b;
  const selectedIds = selectedFieldIds(state.selection);
  const selected = selectedIds.includes(field.id);
  const drag = useDraggable({ id: `fld:${field.id}`, data: { kind: "field", id: field.id } });
  const drop = useDroppable({ id: `on:${field.id}`, data: { kind: "field", id: field.id } });
  const issues = issuesByTarget.get(field.id);
  const hasError = issues?.some((i) => i.severity === "error");
  const logic = marks.targets.has(field.id);
  const meta = FIELD_META[field.type];

  const select = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const ids = selected ? selectedIds.filter((i) => i !== field.id) : [...selectedIds, field.id];
      api.select(ids.length ? { kind: "fields", ids } : null);
    } else api.select({ kind: "fields", ids: [field.id] });
    b.setPanel("field");
  };

  const body: ReactNode =
    field.type === "group" ? (
      <GroupBody group={field} />
    ) : (
      <div inert className="pointer-events-none select-none">
        <Preview field={field} />
      </div>
    );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          id={`fb-${field.id}`}
          ref={(n) => {
            drop.setNodeRef(n);
            drag.setNodeRef(n);
          }}
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={`${meta.label}: ${field.label || "ohne Titel"}`}
          onClick={select}
          onKeyDown={(e) => {
            if (e.key === " " && e.target === e.currentTarget) {
              e.preventDefault();
              select(e);
            }
          }}
          onFocus={(e) => {
            // Nur bei Tastaturfokus auswählen – Mausklicks wählen selbst (⇧-Klick für Mehrfachauswahl)
            if (e.target === e.currentTarget && !selected && e.currentTarget.matches(":focus-visible")) api.select({ kind: "fields", ids: [field.id] });
          }}
          className={cn(
            "group/fb relative -mx-3 my-1 rounded-md px-3 py-3 outline-none transition-[background,box-shadow,opacity] duration-150",
            selected ? "bg-stamp-soft/45 ring-2 ring-stamp" : "hover:bg-paper-2 hover:ring-1 hover:ring-line focus-visible:ring-2 focus-visible:ring-stamp/60",
            hasError && !selected && "ring-1 ring-bad/50",
            drag.isDragging && "opacity-35",
          )}
        >
          <button
            type="button"
            {...drag.listeners}
            {...drag.attributes}
            tabIndex={-1}
            aria-label="Ziehen zum Verschieben"
            className={cn("absolute -left-6 top-3 grid h-7 w-5 cursor-grab place-items-center rounded-sm text-faint hover:bg-desk-2 hover:text-ink active:cursor-grabbing", selected ? "opacity-100" : "opacity-0 group-hover/fb:opacity-100")}
          >
            <GripVertical className="size-4" />
          </button>
          {/* Abzeichen sitzen in der Zeile der Frage – eindeutig diesem Feld zugeordnet */}
          <div className="pointer-events-none absolute right-0 top-0 flex gap-1">
            {logic && (
              <span className="pointer-events-auto inline-flex h-5 items-center gap-1 rounded-xs bg-stamp-soft px-1.5 text-[11px] font-medium text-stamp">
                <GitBranch className="size-3" /> Bedingt
              </span>
            )}
            {issues && (
              <Tip label={issues[0].message}>
                <span className={cn("pointer-events-auto inline-flex h-5 items-center gap-1 rounded-xs px-1.5 text-[11px] font-medium shadow-sm", hasError ? "bg-bad text-white" : "bg-warn-soft text-warn")}>
                  <AlertTriangle className="size-3" /> {hasError ? "Fehler" : "Hinweis"}
                </span>
              </Tip>
            )}
            {field.type === "hidden" && <span className="inline-flex h-5 items-center rounded-xs bg-desk-2 px-1.5 text-[11px] text-muted">Versteckt</span>}
          </div>
          {body}
          <Toolbar field={field} visible={selected} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <FieldMenuItems field={field} Item={ContextMenuItem} Sep={ContextMenuSeparator} />
      </ContextMenuContent>
    </ContextMenu>
  );
});

function Preview({ field }: { field: Field }) {
  if (field.type === "hidden") {
    return (
      <div className="flex items-center gap-2 text-[13.5px] text-muted">
        <FieldIcon type="hidden" className="size-4" />
        <span className="font-medium text-ink-2">{field.label || field.key}</span>
        {field.urlParam && <span className="font-mono text-[12px]">?{field.urlParam}=…</span>}
      </div>
    );
  }
  if (field.type === "image" && !field.imageUrl) {
    return <div className="grid h-24 place-items-center rounded-md border border-dashed border-line-strong text-[13px] text-faint">Bild auswählen im Inspektor</div>;
  }
  if (field.type === "calculated" && !field.expression) {
    return (
      <div>
        <div className="text-[15px] font-medium">{field.label}</div>
        <div className="mt-1 text-[13px] text-faint">Formel fehlt – im Inspektor festlegen.</div>
      </div>
    );
  }
  return <FieldInput field={field} value={field.defaultValue} onChange={() => {}} required={field.required} label={field.label || (isInputField(field) ? "Frage ohne Titel" : field.label)} />;
}

function GroupBody({ group }: { group: Field }) {
  const children = group.fields ?? [];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <FieldIcon type="group" className="size-4 text-stamp" />
        <span className="text-[15px] font-medium text-[var(--f-ink)]">{group.label || "Wiederholgruppe"}</span>
        {group.required && <span className="text-[var(--f-accent)]">*</span>}
        <span className="text-[12.5px] text-muted">
          · {group.minItems ?? 0} bis {group.maxItems ?? 10} × „{group.itemLabel ?? "Eintrag"}“
        </span>
      </div>
      <GroupZone group={group}>
        <FieldList fields={children} container={`group:${group.id}`} />
        {children.length === 0 && <p className="py-3 text-center text-[13px] text-faint">Felder hierher ziehen – sie wiederholen sich pro Eintrag.</p>}
      </GroupZone>
    </div>
  );
}

/** Die ganze Innenfläche einer Gruppe ist Ablagefläche (Ende der Gruppe). */
function GroupZone({ group, children }: { group: Field; children: ReactNode }) {
  const container = `group:${group.id}` as ContainerKey;
  const { setNodeRef, isOver } = useDroppable({ id: `end:${container}`, data: { kind: "end", container } });
  const { dragging } = useBuilder();
  return (
    <div ref={setNodeRef} className={cn("rounded-md border border-dashed border-[var(--f-line)] bg-[var(--f-tint)] px-4 py-2 transition-colors", dragging && "pb-8", isOver && "border-stamp bg-stamp-soft/40")} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

function Toolbar({ field, visible }: { field: Field; visible: boolean }) {
  const { duplicateSelection, deleteSelection, api, state } = useBuilder();
  const single = selectedFieldIds(state.selection).length <= 1;
  return (
    <div
      className={cn("absolute -bottom-3.5 right-2 z-10 flex items-center gap-0.5 rounded-md bg-paper p-0.5 shadow-pop transition-opacity", visible ? "opacity-100" : "pointer-events-none opacity-0 group-hover/fb:pointer-events-auto group-hover/fb:opacity-100")}
      onClick={(e) => e.stopPropagation()}
    >
      <Tip label="Nach oben" shortcut="⌥↑">
        <Button size="icon-sm" variant="ghost" aria-label="Nach oben" onClick={() => api.mutate((d) => void nudge(d, field.id, -1))}><ArrowUp /></Button>
      </Tip>
      <Tip label="Nach unten" shortcut="⌥↓">
        <Button size="icon-sm" variant="ghost" aria-label="Nach unten" onClick={() => api.mutate((d) => void nudge(d, field.id, 1))}><ArrowDown /></Button>
      </Tip>
      <Tip label="Duplizieren" shortcut="⌘D">
        <Button size="icon-sm" variant="ghost" aria-label="Duplizieren" onClick={() => (single && api.select({ kind: "fields", ids: [field.id] }), setTimeout(duplicateSelection, 0))}><Copy /></Button>
      </Tip>
      <Tip label="Löschen" shortcut="⌫">
        <Button size="icon-sm" variant="ghost" aria-label="Löschen" className="hover:text-bad" onClick={() => (single && api.select({ kind: "fields", ids: [field.id] }), setTimeout(deleteSelection, 0))}><Trash2 /></Button>
      </Tip>
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Weitere Aktionen"><MoreHorizontal /></Button>
        </MenuTrigger>
        <MenuContent>
          <FieldMenuItems field={field} Item={MenuItem} Sep={MenuSeparator} />
        </MenuContent>
      </Menu>
    </div>
  );
}

function FieldMenuItems({ field, Item, Sep }: { field: Field; Item: typeof MenuItem; Sep: () => ReactNode }) {
  const { api, state, duplicateSelection, deleteSelection, groupSelection, setPanel, openMobilePanel } = useBuilder();
  const ensure = () => {
    const ids = selectedFieldIds(state.selection);
    if (!ids.includes(field.id)) api.select({ kind: "fields", ids: [field.id] });
  };
  const later = (fn: () => void) => () => {
    ensure();
    setTimeout(fn, 0);
  };
  const pages = useMemo(() => state.def.pages, [state.def.pages]);
  return (
    <>
      <Item shortcut="⌘D" onSelect={later(duplicateSelection)}><Copy /> Duplizieren</Item>
      {field.type === "group" ? (
        <Item onSelect={() => api.mutate((d) => void ungroup(d, field.id))}><Ungroup /> Gruppe auflösen</Item>
      ) : (
        <Item shortcut="⌘G" onSelect={later(groupSelection)}><Group /> In Gruppe zusammenfassen</Item>
      )}
      <Item
        onSelect={() => {
          ensure();
          setPanel("field");
          openMobilePanel(window.matchMedia("(max-width: 1023px)").matches ? "inspector" : null);
          setTimeout(() => document.getElementById("insp-visibility")?.scrollIntoView({ behavior: "smooth" }), 60);
        }}
      >
        <GitBranch /> Bedingung festlegen …
      </Item>
      {isInputField(field) && field.type !== "calculated" && field.type !== "hidden" && (
        <Item onSelect={() => api.mutate((d) => {
          const l = locateIn(d, field.id);
          if (l) l.required = !l.required;
        })}><Asterisk /> {field.required ? "Nicht mehr Pflicht" : "Als Pflichtfeld markieren"}</Item>
      )}
      {pages.length > 1 && (
        <>
          <Sep />
          {pages.map((p, i) => (
            <Item key={p.id} onSelect={() => api.mutate((d) => {
              const from = d.pages.find((pg) => pg.fields.some((f) => f.id === field.id));
              if (!from || from.id === p.id) return;
              const idx = from.fields.findIndex((f) => f.id === field.id);
              const [f] = from.fields.splice(idx, 1);
              d.pages[i].fields.push(f);
            })}>
              Auf Seite {i + 1} verschieben{p.title ? ` (${p.title})` : ""}
            </Item>
          ))}
        </>
      )}
      <Sep />
      <Item danger shortcut="⌫" onSelect={later(deleteSelection)}><Trash2 /> Löschen</Item>
    </>
  );
}

function locateIn(d: FormDefinition, id: string): Field | undefined {
  for (const p of d.pages)
    for (const f of p.fields) {
      if (f.id === id) return f;
      const c = f.fields?.find((x) => x.id === id);
      if (c) return c;
    }
}
