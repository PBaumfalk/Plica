"use client";
/**
 * Der visuelle Formular-Editor. Hält Zustand, Speichern, Drag-and-drop und
 * Tastaturkürzel zusammen; die Flächen (Palette, Blatt, Inspektor) lesen
 * alles über den Builder-Kontext.
 */
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { Eye, Keyboard, Plus, Redo2, Rocket, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCommands } from "@/components/app/command-palette";
import { analyze } from "@/lib/forms/analyze";
import { allKeys, FIELD_META } from "@/lib/forms/fields";
import type { Field, FieldType, FormDefinition } from "@/lib/forms/schema";
import { getDraftStateAction, type BlockSummary } from "@/server/actions/blocks";
import { publishAction, restoreVersionAction } from "@/server/actions/forms";
import { Canvas } from "./canvas";
import { Ctx, type BuilderCtx, type DropTarget, type Panel, type VersionInfo } from "./context";
import { ConflictDialog, IssuesDialog, PublishedDialog, ShortcutsDialog } from "./dialogs";
import { FieldIcon } from "./field-icons";
import { Inspector } from "./inspector";
import { canLiveInGroup, cloneFieldSet, containerOf, duplicateFields, flatOrder, groupFields, insertField, locate, logicMarks, moveField, newField, nudge, removeFields, type ContainerKey } from "./ops";
import { Palette } from "./palette";
import { PreviewDialog } from "./preview";
import { QuickInsert } from "./quick-insert";
import { MobileSheet } from "./sheet";
import { selectedFieldIds, useEditor, type Selection } from "./store";
import { TopBar } from "./top-bar";
import { useAutosave } from "./use-autosave";

/** Stabile Serialisierung (Schlüssel sortiert, undefined weg) für Vergleiche. */
export function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.fromEntries(Object.entries(val as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)));
    }
    return val;
  });
}

type DragData = { kind: "palette"; type: FieldType } | { kind: "block"; block: BlockSummary } | { kind: "field"; id: string };
type DropData = { kind: "field"; id: string } | { kind: "end"; container: ContainerKey };

/** Tiefstes (kleinstes) Ziel unter dem Zeiger – so gewinnen Felder in Gruppen. */
const collide: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length <= 1) return hits;
  const area = (id: string | number) => {
    const r = args.droppableRects.get(id);
    return r ? r.width * r.height : Infinity;
  };
  return [...hits].sort((a, b) => area(a.id) - area(b.id)).slice(0, 1);
};

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[cmdk-root]");
}

export interface BuilderProps {
  formId: string;
  slug: string;
  publicBase: string;
  status: "draft" | "published" | "paused" | "archived";
  definition: FormDefinition;
  revision: number;
  published: FormDefinition | null;
  versions: VersionInfo[];
  blocks: BlockSummary[];
  canPublish: boolean;
}

export function Builder(props: BuilderProps) {
  const router = useRouter();
  const [state, api] = useEditor(props.definition);
  const { def, selection } = state;
  const save = useAutosave(props.formId, def, state.version, props.revision, true);
  const [blocks, setBlocks] = useState(props.blocks);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [panel, setPanel] = useState<Panel>("field");
  const [focusRule, setFocusRule] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [active, setActive] = useState<DragData | null>(null);
  const [quick, setQuick] = useState(false);
  const [preview, setPreview] = useState(false);
  const [help, setHelp] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const warnedRef = useRef(false);
  const [mobile, setMobile] = useState<"palette" | "inspector" | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedJson, setPublishedJson] = useState<string | null>(props.published ? canon(props.published) : null);
  const [status, setStatus] = useState(props.status);
  const [published, setPublished] = useState<{ version: number; url: string } | null>(null);

  // Beim Ziehen keinen Text markieren
  useEffect(() => {
    document.body.classList.toggle("select-none", !!active);
    return () => document.body.classList.remove("select-none");
  }, [active]);

  // Nicht gespeicherte Änderungen vom letzten Besuch (Tab zu schnell geschlossen, Netz weg)
  useEffect(() => {
    const recovered = save.takeRecovery(props.definition);
    if (!recovered) return;
    // Einen Frame warten: Der Toaster der App-Shell registriert sich erst nach diesem Effekt.
    const t = setTimeout(() => toast("Ungespeicherte Änderungen vom letzten Mal gefunden", {
      description: "Sie wurden lokal in diesem Browser gesichert.",
      duration: Infinity,
      action: { label: "Wiederherstellen", onClick: () => api.replace(recovered, true) },
      cancel: { label: "Verwerfen", onClick: () => save.discardRecovery() },
    }), 50);
    return () => clearTimeout(t);
    // nur beim ersten Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-Neuladen (router.refresh) übernimmt neue Versionen und Status
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(props.status);
    setPublishedJson(props.published ? canon(props.published) : null);
  }, [props.status, props.published]);

  const issues = useMemo(() => {
    try {
      return analyze(def);
    } catch {
      return [];
    }
  }, [def]);
  const issuesByTarget = useMemo(() => {
    const m = new Map<string, typeof issues>();
    for (const i of issues) {
      const ids = [i.target, i.ruleId].filter(Boolean) as string[];
      if (i.ruleId) {
        const r = def.rules.find((x) => x.id === i.ruleId);
        r?.actions.forEach((a) => ids.push(a.target));
      }
      for (const id of ids) m.set(id, [...(m.get(id) ?? []), i]);
    }
    return m;
  }, [issues, def.rules]);
  const marks = useMemo(() => logicMarks(def), [def]);

  /** Wohin wird eingefügt? Nach der Auswahl, sonst ans Ende der Seite. */
  const insertionPoint = useCallback(
    (d: FormDefinition, sel: Selection, groupable: boolean): { container: ContainerKey; index: number } => {
      const ids = selectedFieldIds(sel);
      if (ids.length) {
        const l = locate(d, ids[ids.length - 1]);
        if (l) {
          if (l.field.type === "group" && groupable && !l.parent && sel?.kind === "fields" && ids.length === 1) {
            return { container: `group:${l.field.id}`, index: l.field.fields?.length ?? 0 };
          }
          if (l.parent && !groupable) return { container: `page:${l.page.id}`, index: l.page.fields.indexOf(l.parent) + 1 };
          return { container: l.parent ? `group:${l.parent.id}` : `page:${l.page.id}`, index: l.index + 1 };
        }
      }
      if (sel?.kind === "page") {
        const p = d.pages.find((x) => x.id === sel.id);
        if (p) return { container: `page:${p.id}`, index: p.fields.length };
      }
      const last = d.pages[d.pages.length - 1];
      return { container: `page:${last.id}`, index: last.fields.length };
    },
    [],
  );

  const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(`fb-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));

  const insertType = useCallback(
    (type: FieldType, overrides: Partial<Field> = {}) => {
      let created = "";
      api.mutate((d) => {
        const f = newField(d, type, overrides);
        const at = insertionPoint(d, state.selection, canLiveInGroup(f));
        insertField(d, f, at.container, at.index);
        created = f.id;
        return { kind: "fields", ids: [f.id] };
      });
      setPanel("field");
      setTimeout(() => created && scrollTo(created), 30);
    },
    [api, insertionPoint, state.selection],
  );

  const insertBlock = useCallback(
    (block: BlockSummary) => {
      api.mutate((d) => {
        const taken = allKeys(d);
        const copies = cloneFieldSet(block.fields, taken);
        const groupable = copies.every(canLiveInGroup);
        const at = insertionPoint(d, state.selection, groupable);
        copies.forEach((f, i) => insertField(d, f, at.container, at.index + i));
        return { kind: "fields", ids: copies.map((c) => c.id) };
      });
      toast(`Baustein „${block.name}“ eingefügt`);
    },
    [api, insertionPoint, state.selection],
  );

  const deleteSelection = useCallback(() => {
    if (selection?.kind === "page") return;
    const ids = selectedFieldIds(selection);
    if (!ids.length) return;
    const order = flatOrder(def);
    const nextId = order[order.indexOf(ids[ids.length - 1]) + 1] ?? order[order.indexOf(ids[0]) - 1];
    // Vorab an einer Kopie zählen – der Reducer führt die Änderung erst später aus
    const probe = structuredClone(def);
    removeFields(probe, ids);
    const lostRules = def.rules.length - probe.rules.length;
    api.mutate((d) => {
      removeFields(d, ids);
      return nextId && !ids.includes(nextId) ? { kind: "fields", ids: [nextId] } : null;
    });
    // Regeln, die nur auf gelöschte Felder verwiesen, verschwinden mit – das sagen wir offen
    const what = ids.length === 1 ? "Feld" : `${ids.length} Felder`;
    toast(lostRules > 0 ? `${what} und ${lostRules} ${lostRules === 1 ? "Regel" : "Regeln"} entfernt` : `${what} gelöscht`, { action: { label: "Rückgängig", onClick: () => api.undo() } });
  }, [api, def, selection]);

  const duplicateSelection = useCallback(() => {
    const ids = selectedFieldIds(selection);
    if (!ids.length) return;
    api.mutate((d) => ({ kind: "fields", ids: duplicateFields(d, ids) }));
  }, [api, selection]);

  const groupSelection = useCallback(() => {
    const ids = selectedFieldIds(selection);
    if (!ids.length) return;
    let ok = false;
    api.mutate((d) => {
      const g = groupFields(d, ids);
      ok = !!g;
      return g ? { kind: "fields", ids: [g] } : undefined;
    });
    setTimeout(() => {
      if (!ok) toast.error("Nur Felder derselben Seite ohne Datei-Upload, Unterschrift oder Gruppe lassen sich zusammenfassen.");
    }, 0);
  }, [api, selection]);

  const publish = useCallback(async (force?: boolean) => {
    if (issues.some((i) => i.severity === "error")) {
      setIssuesOpen(true);
      return;
    }
    // Hinweise (z. B. keine Pflichtfrage) einmal pro Sitzung vor dem Veröffentlichen zeigen
    if (!force && !warnedRef.current && issues.some((i) => i.severity === "warning")) {
      warnedRef.current = true;
      setIssuesOpen(true);
      return;
    }
    setPublishing(true);
    try {
      if (!(await save.flush())) {
        toast.error("Der Entwurf konnte nicht gespeichert werden – bitte erneut versuchen.");
        return;
      }
      const r = await publishAction(props.formId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setPublishedJson(canon(def));
      setStatus("published");
      setPublished({ version: r.data.version, url: `${props.publicBase}/f/${r.data.slug}` });
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }, [issues, save, props.formId, props.publicBase, def, router]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      await save.flush();
      const r = await restoreVersionAction(props.formId, versionId);
      if (!r.ok) return void toast.error(r.error);
      const s = await getDraftStateAction(props.formId);
      if (!s.ok) return void toast.error(s.error);
      save.adopt(s.data.revision, false);
      api.replace(s.data.definition, true);
      toast("Version als Entwurf wiederhergestellt", { action: { label: "Rückgängig", onClick: () => api.undo() } });
    },
    [api, props.formId, save],
  );

  /* ---------- Drag & Drop ---------- */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const draggedType = (a: DragData | null): "groupable" | "page-only" => {
    if (!a) return "groupable";
    if (a.kind === "palette") return canLiveInGroup({ type: a.type }) ? "groupable" : "page-only";
    if (a.kind === "block") return a.block.fields.every(canLiveInGroup) ? "groupable" : "page-only";
    const l = locate(def, a.id);
    return l && canLiveInGroup(l.field) ? "groupable" : "page-only";
  };

  function computeTarget(e: DragMoveEvent): DropTarget {
    const over = e.over;
    if (!over) return null;
    const data = over.data.current as DropData | undefined;
    if (!data) return null;
    const groupable = draggedType(active) === "groupable";
    if (data.kind === "end") {
      if (data.container.startsWith("group:") && !groupable) {
        const g = locate(def, data.container.slice(6));
        if (!g) return null;
        return { container: `page:${g.page.id}`, index: g.index + 1 };
      }
      const l = data.container.startsWith("group:") ? locate(def, data.container.slice(6))?.field.fields : def.pages.find((p) => `page:${p.id}` === data.container)?.fields;
      return { container: data.container, index: l?.length ?? 0 };
    }
    const l = locate(def, data.id);
    if (!l) return null;
    const pointer = e.activatorEvent as PointerEvent;
    const y = (pointer?.clientY ?? 0) + e.delta.y;
    const after = y > over.rect.top + over.rect.height / 2;
    if (l.parent && !groupable) return { container: `page:${l.page.id}`, index: l.page.fields.indexOf(l.parent) + (after ? 1 : 0) };
    if (active?.kind === "field" && l.field.type === "group" && active.id === l.field.id) return null;
    return { container: (l.parent ? `group:${l.parent.id}` : `page:${l.page.id}`) as ContainerKey, index: l.index + (after ? 1 : 0) };
  }

  function onDragStart(e: DragStartEvent) {
    setActive(e.active.data.current as DragData);
  }
  function onDragMove(e: DragMoveEvent) {
    const t = computeTarget(e);
    setDropTarget((prev) => (prev?.container === t?.container && prev?.index === t?.index ? prev : t));
  }
  function onDragEnd(e: DragEndEvent) {
    const t = dropTarget;
    const a = active;
    setActive(null);
    setDropTarget(null);
    if (!t || !a || !e.over) return;
    if (a.kind === "palette") {
      api.mutate((d) => {
        const f = newField(d, a.type);
        return insertField(d, f, t.container, t.index) ? { kind: "fields", ids: [f.id] } : undefined;
      });
      setPanel("field");
    } else if (a.kind === "block") {
      api.mutate((d) => {
        const taken = allKeys(d);
        const copies = cloneFieldSet(a.block.fields, taken);
        copies.forEach((f, i) => insertField(d, f, t.container, t.index + i));
        return { kind: "fields", ids: copies.map((c) => c.id) };
      });
    } else {
      if (containerOf(def, a.id) === t.container) {
        const l = locate(def, a.id)!;
        if (t.index === l.index || t.index === l.index + 1) return;
      }
      api.mutate((d) => {
        moveField(d, a.id, t.container, t.index);
        return { kind: "fields", ids: [a.id] };
      });
    }
  }

  /* ---------- Tastatur ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = isTyping(e.target);
      const k = e.key.toLowerCase();
      if (document.querySelector("[role=dialog][data-state=open]") && !(mod && (k === "z" || k === "y"))) {
        // Dialoge behandeln ihre Tasten selbst
        if (!document.querySelector("[data-builder-sheet][data-state=open]")) return;
      }
      if (mod && k === "z") {
        if (typing && !e.shiftKey && (e.target as HTMLElement).closest("[data-native-undo]")) return;
        e.preventDefault();
        if (e.shiftKey) api.redo();
        else api.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        api.redo();
        return;
      }
      if (mod && k === "s") {
        e.preventDefault();
        void save.flush().then((ok) => ok && toast("Gespeichert"));
        return;
      }
      if (mod && e.shiftKey && k === "p") {
        e.preventDefault();
        setPreview(true);
        return;
      }
      if (typing) return;
      const ids = selectedFieldIds(state.selection);
      if (mod && k === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && k === "g") {
        e.preventDefault();
        groupSelection();
      } else if (e.key === "/" ) {
        e.preventDefault();
        setQuick(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      } else if ((e.key === "Backspace" || e.key === "Delete") && ids.length) {
        e.preventDefault();
        deleteSelection();
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && ids.length === 1) {
        e.preventDefault();
        api.mutate((d) => {
          nudge(d, ids[0], e.key === "ArrowUp" ? -1 : 1);
        });
        scrollTo(ids[0]);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const order = flatOrder(def);
        if (!order.length) return;
        e.preventDefault();
        const cur = ids.length ? order.indexOf(ids[ids.length - 1]) : -1;
        const next = e.key === "ArrowDown" ? Math.min(order.length - 1, cur + 1) : cur < 0 ? order.length - 1 : Math.max(0, cur - 1);
        api.select({ kind: "fields", ids: [order[next]] });
        scrollTo(order[next]);
      } else if (e.key === "Enter" && ids.length === 1) {
        e.preventDefault();
        setPanel("field");
        if (window.matchMedia("(max-width: 1023px)").matches) setMobile("inspector");
        setTimeout(() => (document.getElementById("insp-label") as HTMLInputElement | null)?.select(), 40);
      } else if (e.key === "Escape" && state.selection) {
        api.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, def, state.selection, save, deleteSelection, duplicateSelection, groupSelection]);

  useCommands("builder", [
    { id: "b-insert", label: "Feld einfügen …", group: "Editor", icon: <Plus />, shortcut: "/", run: () => setQuick(true) },
    { id: "b-preview", label: "Vorschau öffnen", group: "Editor", icon: <Eye />, shortcut: "⌘⇧P", run: () => setPreview(true) },
    { id: "b-undo", label: "Rückgängig", group: "Editor", icon: <Undo2 />, shortcut: "⌘Z", run: () => api.undo() },
    { id: "b-redo", label: "Wiederholen", group: "Editor", icon: <Redo2 />, shortcut: "⌘⇧Z", run: () => api.redo() },
    ...(props.canPublish ? [{ id: "b-publish", label: "Veröffentlichen", group: "Editor", icon: <Rocket />, run: () => void publish() }] : []),
    { id: "b-help", label: "Tastaturkürzel", group: "Editor", icon: <Keyboard />, shortcut: "?", run: () => setHelp(true) },
  ]);

  const ctx: BuilderCtx = {
    formId: props.formId,
    slug: props.slug,
    status,
    state,
    api,
    issues,
    issuesByTarget,
    marks,
    blocks,
    setBlocks,
    canPublish: props.canPublish,
    device,
    setDevice,
    panel,
    setPanel,
    focusRule,
    setFocusRule,
    dropTarget,
    dragging: !!active,
    save: { status: save.status, error: save.error, flush: save.flush },
    insertType,
    insertBlock,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    openQuickInsert: () => setQuick(true),
    openPreview: () => setPreview(true),
    openMobilePanel: setMobile,
    publishedJson,
    versions: props.versions,
    publish,
    publishing,
    restoreVersion,
  };

  const overlay = active && (
    <div className="pointer-events-none flex h-9 items-center gap-2 rounded-md bg-paper px-3 text-[13.5px] font-medium shadow-pop ring-1 ring-stamp/30">
      {active.kind === "palette" && (
        <>
          <FieldIcon type={active.type} className="size-4 text-stamp" /> {FIELD_META[active.type].label}
        </>
      )}
      {active.kind === "block" && <>Baustein: {active.block.name}</>}
      {active.kind === "field" && (() => {
        const f = locate(def, active.id)?.field;
        return f ? (
          <>
            <FieldIcon type={f.type} className="size-4 text-stamp" /> {f.label || FIELD_META[f.type].label}
          </>
        ) : null;
      })()}
    </div>
  );

  return (
    <Ctx.Provider value={ctx}>
      <DndContext id="plica-builder" sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragMove={onDragMove} onDragOver={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => (setActive(null), setDropTarget(null))}>
        <div className="flex h-dvh flex-col overflow-hidden bg-desk">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <aside aria-label="Felder einfügen" className="hidden w-[292px] shrink-0 flex-col border-r border-line bg-desk lg:flex">
              <Palette />
            </aside>
            <div role="region" aria-label="Formular-Blatt" className="min-w-0 flex-1 overflow-y-auto" id="builder-canvas" onClick={(e) => e.target === e.currentTarget && api.select(null)}>
              <Canvas />
            </div>
            <aside aria-label="Eigenschaften" className="hidden w-[360px] shrink-0 flex-col border-l border-line bg-paper lg:flex">
              <Inspector />
            </aside>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
      </DndContext>
      <MobileSheet open={mobile === "palette"} onOpenChange={(o) => setMobile(o ? "palette" : null)} title="Feld einfügen">
        <Palette onPicked={() => setMobile(null)} />
      </MobileSheet>
      <MobileSheet open={mobile === "inspector"} onOpenChange={(o) => setMobile(o ? "inspector" : null)} title="Eigenschaften">
        <Inspector />
      </MobileSheet>
      <QuickInsert open={quick} onOpenChange={setQuick} />
      <PreviewDialog open={preview} onOpenChange={setPreview} />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
      <IssuesDialog open={issuesOpen} onOpenChange={setIssuesOpen} onPublishAnyway={() => void publish(true)} />
      <PublishedDialog formId={props.formId} published={published} onClose={() => setPublished(null)} />
      <ConflictDialog
        open={save.status === "conflict"}
        onReload={() => {
          save.adopt(0, true);
          window.location.reload();
        }}
        onKeep={async () => {
          const s = await getDraftStateAction(props.formId);
          if (!s.ok) return void toast.error(s.error);
          save.adopt(s.data.revision, false);
          if (await save.flush()) toast("Deine Fassung wurde gespeichert");
        }}
      />
    </Ctx.Provider>
  );
}
