import type { SubmissionStatus } from "../db/schema";

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  new: "Neu",
  in_review: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  done: "Erledigt",
  spam: "Spam",
};
