"use client";
/**
 * Editor-Zustand mit Verlauf. Änderungen mit gleichem `coalesce`-Schlüssel
 * innerhalb kurzer Zeit (Tippen) werden zu einem Undo-Schritt zusammengefasst.
 */
import { useCallback, useMemo, useReducer } from "react";
import type { FormDefinition } from "@/lib/forms/schema";

export type Selection = { kind: "fields"; ids: string[] } | { kind: "page"; id: string } | null;

export interface EditorState {
  def: FormDefinition;
  past: FormDefinition[];
  future: FormDefinition[];
  selection: Selection;
  lastKey: string | null;
  lastAt: number;
  /** Erhöht sich bei jeder inhaltlichen Änderung (für Autosave). */
  version: number;
}

type Action =
  | { type: "mutate"; fn: (draft: FormDefinition) => Selection | void; coalesce?: string }
  | { type: "replace"; def: FormDefinition; record: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; selection: Selection };

const LIMIT = 200;
const COALESCE_MS = 900;

function reducer(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case "mutate": {
      const draft = structuredClone(s.def);
      const sel = a.fn(draft);
      const now = Date.now();
      const merge = a.coalesce && a.coalesce === s.lastKey && now - s.lastAt < COALESCE_MS;
      return {
        ...s,
        def: draft,
        past: merge ? s.past : [...s.past, s.def].slice(-LIMIT),
        future: [],
        selection: sel === undefined ? s.selection : sel,
        lastKey: a.coalesce ?? null,
        lastAt: now,
        version: s.version + 1,
      };
    }
    case "replace":
      return {
        ...s,
        def: a.def,
        past: a.record ? [...s.past, s.def].slice(-LIMIT) : s.past,
        future: a.record ? [] : s.future,
        lastKey: null,
        version: s.version + 1,
      };
    case "undo": {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...s, def: prev, past: s.past.slice(0, -1), future: [s.def, ...s.future], lastKey: null, version: s.version + 1, selection: keepSelection(prev, s.selection) };
    }
    case "redo": {
      if (!s.future.length) return s;
      const next = s.future[0];
      return { ...s, def: next, past: [...s.past, s.def], future: s.future.slice(1), lastKey: null, version: s.version + 1, selection: keepSelection(next, s.selection) };
    }
    case "select":
      return { ...s, selection: a.selection, lastKey: null };
  }
}

function keepSelection(def: FormDefinition, sel: Selection): Selection {
  if (!sel) return null;
  const ids = new Set<string>();
  for (const p of def.pages) {
    ids.add(p.id);
    for (const f of p.fields) {
      ids.add(f.id);
      for (const c of f.fields ?? []) ids.add(c.id);
    }
  }
  if (sel.kind === "page") return ids.has(sel.id) ? sel : null;
  const kept = sel.ids.filter((i) => ids.has(i));
  return kept.length ? { kind: "fields", ids: kept } : null;
}

export function useEditor(initial: FormDefinition) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ def: initial, past: [], future: [], selection: null, lastKey: null, lastAt: 0, version: 0 }));
  const mutate = useCallback((fn: (d: FormDefinition) => Selection | void, coalesce?: string) => dispatch({ type: "mutate", fn, coalesce }), []);
  const api = useMemo(
    () => ({
      mutate,
      replace: (def: FormDefinition, record = true) => dispatch({ type: "replace", def, record }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      select: (selection: Selection) => dispatch({ type: "select", selection }),
    }),
    [mutate],
  );
  return [state, api] as const;
}

export type EditorApi = ReturnType<typeof useEditor>[1];

export function selectedFieldIds(sel: Selection): string[] {
  return sel?.kind === "fields" ? sel.ids : [];
}
