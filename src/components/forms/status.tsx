import { Badge } from "@/components/ui/misc";

export const STATUS = {
  draft: { label: "Entwurf", tone: "neutral" },
  published: { label: "Veröffentlicht", tone: "ok" },
  paused: { label: "Pausiert", tone: "warn" },
  archived: { label: "Archiviert", tone: "neutral" },
} as const;

export function FormStatusBadge({ status }: { status: keyof typeof STATUS }) {
  return <Badge tone={STATUS[status].tone} dot>{STATUS[status].label}</Badge>;
}
