"use client";
import { createContext, useContext } from "react";
import type { Issue } from "@/lib/forms/analyze";
import type { Field, FieldType } from "@/lib/forms/schema";
import type { BlockSummary } from "@/server/actions/blocks";
import type { ContainerKey } from "./ops";
import type { EditorApi, EditorState } from "./store";
import type { SaveStatus } from "./use-autosave";

export type Panel = "field" | "logic" | "endings" | "design";
export type DropTarget = { container: ContainerKey; index: number } | null;

export interface VersionInfo {
  id: string;
  number: number;
  publishedAt: string;
  publishedBy: string | null;
  submissions: number;
}

export interface BuilderCtx {
  formId: string;
  slug: string;
  status: "draft" | "published" | "paused" | "archived";
  state: EditorState;
  api: EditorApi;
  issues: Issue[];
  issuesByTarget: Map<string, Issue[]>;
  marks: { targets: Set<string>; sources: Set<string> };
  blocks: BlockSummary[];
  setBlocks: (b: BlockSummary[]) => void;
  canPublish: boolean;
  device: "desktop" | "mobile";
  setDevice: (d: "desktop" | "mobile") => void;
  panel: Panel;
  setPanel: (p: Panel) => void;
  focusRule: string | null;
  setFocusRule: (id: string | null) => void;
  dropTarget: DropTarget;
  dragging: boolean;
  save: { status: SaveStatus; error: string | null; flush: () => Promise<boolean> };
  /** Einfügen am aktuellen Einfügepunkt (nach Auswahl bzw. am Seitenende). */
  insertType: (type: FieldType, overrides?: Partial<Field>) => void;
  insertBlock: (block: BlockSummary) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  groupSelection: () => void;
  openQuickInsert: () => void;
  openPreview: () => void;
  openMobilePanel: (which: "palette" | "inspector" | null) => void;
  publishedJson: string | null;
  versions: VersionInfo[];
  publish: () => Promise<void>;
  publishing: boolean;
  restoreVersion: (id: string) => Promise<void>;
}

export const Ctx = createContext<BuilderCtx | null>(null);

export function useBuilder(): BuilderCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBuilder außerhalb des Builders");
  return c;
}
