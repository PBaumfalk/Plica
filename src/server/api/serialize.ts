import "server-only";
import { answerRows } from "@/lib/forms/format";
import type { FormDefinition } from "@/lib/forms/schema";
import type { SubmissionRow } from "../db/schema";

/** Antworten nach Feldschlüssel – stabil für Integrationen, unabhängig von Beschriftungen. */
export function serializeSubmission(s: SubmissionRow, def: FormDefinition, versionNumber: number) {
  const rows = answerRows(def, s.data);
  return {
    id: s.id,
    number: s.number,
    formId: s.formId,
    formVersion: versionNumber,
    status: s.status,
    tags: s.tags,
    starred: s.starred,
    submittedAt: s.submittedAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    answers: Object.fromEntries(rows.map((r) => [r.field.key, r.value])),
    display: Object.fromEntries(rows.map((r) => [r.field.key, { label: r.label, text: r.text, type: r.field.type }])),
  };
}
