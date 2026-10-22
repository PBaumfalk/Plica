import type { FieldType } from "@/lib/forms/schema";

export type Status = "new" | "in_review" | "approved" | "rejected" | "done" | "spam";

export interface ResponsesData {
  form: { id: string; title: string; slug: string; published: boolean; status: string };
  columns: { fieldId: string; label: string; type: FieldType; options?: { value: string; label: string }[] }[];
  rows: { id: string; number: number; status: Status; tags: string[]; starred: boolean; submittedAt: string; version: number; email: string | null; cells: Record<string, string> }[];
  total: number;
  page: number;
  pageSize: number;
  query: Record<string, string>;
  counts: Partial<Record<Status, number>>;
  tags: string[];
  views: { id: string; name: string; query: Record<string, string>; shared: boolean; mine: boolean }[];
  can: { update: boolean; delete: boolean; export: boolean; release: boolean; share: boolean };
}

export interface DetailFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: "pending" | "clean" | "unscanned" | "infected";
  released: boolean;
  scanNote: string | null;
}

export interface DetailItem {
  fieldId: string;
  label: string;
  type: FieldType;
  text: string;
  lines?: string[];
  group?: { title: string; rows: { label: string; value: string }[] }[];
  files?: DetailFile[];
  signature?: { fileId: string; signedAt: string | null; hash: string; ipHash?: string; userAgent?: string } | null;
}

export interface DetailData {
  id: string;
  number: number;
  status: Status;
  tags: string[];
  starred: boolean;
  submittedAt: string;
  version: number;
  meta: { durationMs?: number; embedded?: boolean; userAgent?: string; prefillFrom?: string };
  email: string | null;
  deleteAfter: string | null;
  endingTitle: string | null;
  sections: { title: string; items: DetailItem[] }[];
  notes: { id: string; body: string; createdAt: string; user: string | null; mine: boolean }[];
  timeline: { id: string; at: string; who: string | null; text: string; kind: "event" | "note" | "run"; tone?: "ok" | "bad" }[];
  prev: string | null;
  next: string | null;
}
