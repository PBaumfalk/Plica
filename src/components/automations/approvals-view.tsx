"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { Check, CheckCheck, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { FormRow, Textarea } from "@/components/ui/input";
import { Badge, Empty, PageHeader } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/time";
import { decideApprovalAction } from "@/server/actions/approvals";

type Item = {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  comment: string | null;
  createdAt: string;
  decidedAt: string | null;
  deciderName: string | null;
  assigneeRole: string;
  mayDecide: boolean;
  formId: string;
  submissionId: string;
  formTitle: string;
  number: number;
  summary: { label: string; text: string }[];
};

const ROLE_NAME: Record<string, string> = { reviewer: "Prüfer", editor: "Bearbeiter", admin: "Administratoren", owner: "Inhaber" };

export function ApprovalsView({ items }: { items: Item[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [deciding, setDeciding] = useState<{ item: Item; decision: "approved" | "rejected" } | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = items.filter((i) => (tab === "pending" ? i.status === "pending" : i.status !== "pending"));
  const openCount = items.filter((i) => i.status === "pending").length;

  function decide() {
    if (!deciding) return;
    setError(null);
    start(async () => {
      const r = await decideApprovalAction(deciding.item.id, { decision: deciding.decision, comment: comment || undefined });
      if (!r.ok) return setError(r.error);
      toast(deciding.decision === "approved" ? "Freigabe erteilt" : "Freigabe abgelehnt");
      setDeciding(null);
      setComment("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader title="Freigaben" description={openCount ? `${openCount} ${openCount === 1 ? "Antwort wartet" : "Antworten warten"} auf eine Entscheidung.` : "Alles entschieden."} />
      <div className="mb-4">
        <Segmented label="Ansicht" size="sm" value={tab} onChange={setTab} options={[{ value: "pending", label: `Offen${openCount ? ` · ${openCount}` : ""}` }, { value: "decided", label: "Entschieden" }]} />
      </div>
      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-paper/50">
          <Empty icon={<CheckCheck />} title={tab === "pending" ? "Keine offenen Freigaben" : "Noch nichts entschieden"}>
            Freigaben entstehen durch Automationen mit dem Schritt „Freigabe anfordern“ – zum Beispiel für Aufträge über einem bestimmten Betrag.
          </Empty>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <li key={i.id} className="rounded-lg bg-paper shadow-sheet">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{i.title}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    <Link href={`/formulare/${i.formId}/antworten/${i.submissionId}`} className="inline-flex items-center gap-1 hover:text-ink">
                      {i.formTitle} · Antwort #{i.number} <ExternalLink className="size-3" />
                    </Link>
                    <span> · angefordert <TimeAgo at={i.createdAt} /> · für {ROLE_NAME[i.assigneeRole] ?? i.assigneeRole}</span>
                  </div>
                </div>
                {i.status === "pending" ? (
                  i.mayDecide ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setDeciding({ item: i, decision: "rejected" })}><X /> Ablehnen</Button>
                      <Button size="sm" variant="primary" onClick={() => setDeciding({ item: i, decision: "approved" })}><Check /> Freigeben</Button>
                    </div>
                  ) : (
                    <Badge>Wartet auf {ROLE_NAME[i.assigneeRole] ?? i.assigneeRole}</Badge>
                  )
                ) : (
                  <div className="text-right">
                    <Badge tone={i.status === "approved" ? "ok" : "bad"} dot>{i.status === "approved" ? "Freigegeben" : "Abgelehnt"}</Badge>
                    <div className="mt-1 text-[12px] text-muted" title={i.decidedAt ? dateTime(i.decidedAt) : undefined}>{i.deciderName ?? "Unbekannt"} · {i.decidedAt ? <TimeAgo at={i.decidedAt} /> : ""}</div>
                  </div>
                )}
              </div>
              <dl className="grid gap-x-6 gap-y-1.5 px-5 py-4 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                {i.summary.map((s, n) => (
                  <div key={n} className="contents">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="break-words">{s.text}</dd>
                  </div>
                ))}
              </dl>
              {i.comment && <p className={cn("border-t border-line px-5 py-3 text-[13.5px]", i.status === "rejected" ? "text-bad" : "text-ink-2")}>„{i.comment}“</p>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!deciding} onOpenChange={(o) => !o && (setDeciding(null), setError(null))}>
        <DialogContent title={deciding?.decision === "approved" ? "Freigabe erteilen" : "Freigabe ablehnen"} description={deciding ? `${deciding.item.title} · ${deciding.item.formTitle} #${deciding.item.number}` : ""}>
          <div className="space-y-4">
            <FormRow label={deciding?.decision === "rejected" ? "Begründung" : "Kommentar (optional)"} htmlFor="ap-comment" error={error}>
              <Textarea id="ap-comment" autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder={deciding?.decision === "rejected" ? "Warum wird abgelehnt?" : ""} maxLength={2000} />
            </FormRow>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDeciding(null)}>Abbrechen</Button>
              <Button variant={deciding?.decision === "approved" ? "primary" : "danger"} onClick={decide} loading={pending}>
                {deciding?.decision === "approved" ? "Freigeben" : "Ablehnen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
