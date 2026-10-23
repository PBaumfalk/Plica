"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, CircleDot, FileText, FlaskConical, GitBranch, Mail, MailCheck, MoreHorizontal, Pencil, Plus, RotateCcw, ShieldCheck, Trash2, Webhook, X, Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Select, Switch } from "@/components/ui/controls";
import { FormRow, Input, Textarea } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { Dialog, DialogContent, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/forms/fields";
import { dateTime } from "@/lib/time";
import { deleteWorkflowAction, retryRunAction, saveWorkflowAction, testWorkflowAction, toggleWorkflowAction, workflowRunsAction } from "@/server/actions/workflows";
import type { WorkflowCondition, WorkflowStep, WorkflowTrigger } from "@/server/db/schema";
import type { WorkflowInputT } from "@/server/workflows/schema";

export type FieldOption = { id: string; key: string; label: string; type: string; options?: { value: string; label: string }[] };
type Status = "new" | "in_review" | "approved" | "rejected" | "done";
type Workflow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  triggerStatus: Status | null;
  condition: WorkflowCondition | null;
  steps: WorkflowStep[];
  elseSteps: WorkflowStep[];
  lastRun: { status: string; at: string } | null;
};
type Run = { id: string; workflowId: string; status: string; branch: string | null; test: boolean; createdAt: string; finishedAt: string | null; submissionNumber: number | null; log: { at: string; step: string; ok: boolean; message: string; attempt?: number }[] };

const TRIGGERS: { value: WorkflowTrigger; label: string; sentence: string }[] = [
  { value: "submission.created", label: "Neue Antwort eingegangen", sentence: "Bei jeder neuen Antwort" },
  { value: "submission.status_changed", label: "Status einer Antwort geändert", sentence: "Wenn sich der Status ändert" },
  { value: "approval.approved", label: "Freigabe erteilt", sentence: "Wenn eine Freigabe erteilt wurde" },
  { value: "approval.rejected", label: "Freigabe abgelehnt", sentence: "Wenn eine Freigabe abgelehnt wurde" },
];
const STATUS: { value: Status; label: string }[] = [
  { value: "new", label: "Neu" },
  { value: "in_review", label: "In Prüfung" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "done", label: "Erledigt" },
];
const ROLES = [
  { value: "reviewer", label: "Prüfer und höher" },
  { value: "editor", label: "Bearbeiter und höher" },
  { value: "admin", label: "Administratoren und Inhaber" },
  { value: "owner", label: "Nur Inhaber" },
];

const STEP_META: Record<WorkflowStep["type"], { label: string; hint: string; icon: ReactNode }> = {
  email: { label: "E-Mail senden", hint: "An feste Adressen oder an ein E-Mail-Feld", icon: <Mail /> },
  confirmation: { label: "Bestätigung an Einreichende", hint: "An die E-Mail-Adresse aus der Antwort", icon: <MailCheck /> },
  webhook: { label: "Webhook auslösen", hint: "Signierter POST an ein anderes System", icon: <Webhook /> },
  set_status: { label: "Status ändern", hint: "Antwort weiterschalten", icon: <CircleDot /> },
  approval: { label: "Freigabe anfordern", hint: "Aufgabe für das Team", icon: <ShieldCheck /> },
  pdf: { label: "PDF erzeugen", hint: "Als Datei an der Antwort ablegen", icon: <FileText /> },
};

const RUN_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" | "stamp" }> = {
  running: { label: "Läuft", tone: "stamp" },
  succeeded: { label: "Erfolgreich", tone: "ok" },
  partial: { label: "Teilweise", tone: "warn" },
  failed: { label: "Fehlgeschlagen", tone: "bad" },
};

function newStep(type: WorkflowStep["type"]): WorkflowStep {
  const id = newId("s_");
  switch (type) {
    case "email":
      return { id, type, to: "", subject: "Neue Antwort #{{plica.nummer}}: {{plica.formular}}", body: "Es ist eine neue Antwort eingegangen.\n\n{{plica.antworten}}\n\n{{plica.link}}" };
    case "confirmation":
      return { id, type, subject: "Ihre Angaben sind eingegangen", body: "Guten Tag,\n\nvielen Dank – wir haben Ihre Angaben zu „{{plica.formular}}“ erhalten und melden uns zeitnah.\n\nIhre Angaben:\n{{plica.antworten}}" };
    case "webhook":
      return { id, type, url: "" };
    case "set_status":
      return { id, type, status: "in_review" };
    case "approval":
      return { id, type, title: "Antwort #{{plica.nummer}} prüfen", assigneeRole: "reviewer" };
    case "pdf":
      return { id, type };
  }
}

const PRESETS: { name: string; description: string; icon: ReactNode; build: () => Omit<Workflow, "id" | "lastRun"> }[] = [
  {
    name: "Team benachrichtigen",
    description: "E-Mail mit allen Angaben an euch",
    icon: <Mail />,
    build: () => ({ name: "Team benachrichtigen", enabled: true, trigger: "submission.created", triggerStatus: null, condition: null, steps: [newStep("email")], elseSteps: [] }),
  },
  {
    name: "Eingangsbestätigung",
    description: "Absender erhält eine Bestätigung mit PDF",
    icon: <MailCheck />,
    build: () => ({ name: "Eingangsbestätigung", enabled: true, trigger: "submission.created", triggerStatus: null, condition: null, steps: [{ ...(newStep("confirmation") as Extract<WorkflowStep, { type: "confirmation" }>), attachPdf: true }], elseSteps: [] }),
  },
  {
    name: "Prüfen und freigeben",
    description: "Freigabe anfordern, danach weiter",
    icon: <ShieldCheck />,
    build: () => ({ name: "Prüfen und freigeben", enabled: true, trigger: "submission.created", triggerStatus: null, condition: null, steps: [newStep("approval")], elseSteps: [] }),
  },
  {
    name: "An anderes System senden",
    description: "Signierter Webhook, z. B. an die Aktenverwaltung",
    icon: <Webhook />,
    build: () => ({ name: "Webhook", enabled: true, trigger: "submission.created", triggerStatus: null, condition: null, steps: [newStep("webhook")], elseSteps: [] }),
  },
];

function triggerSentence(w: Pick<Workflow, "trigger" | "triggerStatus">) {
  const t = TRIGGERS.find((x) => x.value === w.trigger)!;
  if (w.trigger === "submission.status_changed" && w.triggerStatus) return `Wenn der Status auf „${STATUS.find((s) => s.value === w.triggerStatus)?.label}“ wechselt`;
  return t.sentence;
}

export function AutomationsView(props: { formId: string; fields: FieldOption[]; workflows: Workflow[]; runs: Run[]; canWrite: boolean; mailReady: boolean; allowPrivateWebhooks: boolean; hasSubmissions: boolean }) {
  const { formId, fields, workflows, canWrite, mailReady } = props;
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Omit<Workflow, "id" | "lastRun"> } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Workflow | null>(null);
  const [confirmTest, setConfirmTest] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<Run[]>(props.runs);
  const [, start] = useTransition();
  const poll = useRef<number | null>(null);

  const loadRuns = useCallback(async () => {
    const r = await workflowRunsAction(formId);
    if (r.ok) setRuns(r.data);
    return r.ok ? r.data : [];
  }, [formId]);

  useEffect(() => {
    return () => {
      if (poll.current) window.clearInterval(poll.current);
    };
  }, []);

  function pollRuns() {
    if (poll.current) window.clearInterval(poll.current);
    let n = 0;
    poll.current = window.setInterval(async () => {
      const data = await loadRuns();
      if (++n > 20 || (n > 2 && !data.some((r) => r.status === "running"))) {
        window.clearInterval(poll.current!);
        poll.current = null;
        router.refresh();
      }
    }, 1500);
  }

  const usesMail = workflows.some((w) => w.enabled && [...w.steps, ...w.elseSteps].some((s) => s.type === "email" || s.type === "confirmation"));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-[14px] text-muted">
          Automationen reagieren auf neue Antworten, Statuswechsel und Freigaben. Jeder Lauf wird protokolliert; vorübergehende Fehler werden automatisch wiederholt. Stößt du einen fehlgeschlagenen Lauf erneut an, läuft er komplett neu.
        </p>
        {canWrite && workflows.length > 0 && (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="primary"><Plus /> Neue Automation <ChevronDown className="opacity-70" /></Button>
            </MenuTrigger>
            <MenuContent className="w-72">
              {PRESETS.map((p) => (
                <MenuItem key={p.name} onSelect={() => setEditing({ id: null, draft: p.build() })}>
                  {p.icon}
                  <span className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-[12px] text-muted">{p.description}</span>
                  </span>
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={() => setEditing({ id: null, draft: { name: "Neue Automation", enabled: true, trigger: "submission.created", triggerStatus: null, condition: null, steps: [], elseSteps: [] } })}>
                <Zap /> Leer beginnen
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>

      {usesMail && !mailReady && (
        <div role="status" className="flex items-start gap-3 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-[13.5px] text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>E-Mail-Versand ist auf diesem Server nicht eingerichtet (SMTP_URL). E-Mail-Schritte schlagen fehl und erscheinen im Protokoll, bis der Versand konfiguriert ist.</span>
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-paper/50 px-4 pb-8">
          <Empty icon={<Zap />} title="Noch keine Automationen">
            Lass PLICA nach jeder Antwort die Arbeit erledigen: Team informieren, Bestätigung senden, Freigaben anfordern oder Daten an andere Systeme übergeben.
          </Empty>
          {canWrite && (
            <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setEditing({ id: null, draft: p.build() })} className="flex items-start gap-3 rounded-md border border-line bg-paper p-3.5 text-left transition-colors hover:border-stamp-line hover:bg-stamp-soft/40 [&_svg]:size-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-stamp-soft text-stamp">{p.icon}</span>
                  <span>
                    <span className="block text-[14px] font-medium">{p.name}</span>
                    <span className="block text-[12.5px] text-muted">{p.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg bg-paper shadow-sheet">
          {workflows.map((w) => (
            <li key={w.id} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
              {canWrite ? (
                <Switch
                  checked={w.enabled}
                  label={`${w.name} ${w.enabled ? "deaktivieren" : "aktivieren"}`}
                  onCheckedChange={(on) =>
                    start(async () => {
                      const r = await toggleWorkflowAction(w.id, on);
                      if (!r.ok) return void toast.error(r.error);
                      toast(on ? "Automation aktiviert" : "Automation pausiert");
                      router.refresh();
                    })
                  }
                />
              ) : (
                <span className={cn("size-2 rounded-full", w.enabled ? "bg-ok" : "bg-line-strong")} aria-label={w.enabled ? "Aktiv" : "Pausiert"} />
              )}
              <button className="min-w-0 flex-1 text-left" onClick={() => canWrite && setEditing({ id: w.id, draft: { ...w } })} disabled={!canWrite}>
                <div className={cn("truncate text-[14.5px] font-medium", !w.enabled && "text-muted")}>{w.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
                  <span>{triggerSentence(w)}</span>
                  {w.condition && w.condition.conditions.length > 0 && <span className="inline-flex items-center gap-1"><GitBranch className="size-3" /> mit Bedingung</span>}
                  <ChevronRight className="size-3" />
                  <span className="inline-flex items-center gap-1 [&_svg]:size-3.5">
                    {w.steps.map((s) => <span key={s.id} title={STEP_META[s.type].label}>{STEP_META[s.type].icon}</span>)}
                    {w.steps.length === 1 ? STEP_META[w.steps[0].type].label : `${w.steps.length} Schritte`}
                  </span>
                </div>
              </button>
              <div className="hidden text-right text-[12px] sm:block">
                {w.lastRun ? (
                  <>
                    <Badge tone={RUN_STATUS[w.lastRun.status]?.tone ?? "neutral"}>{RUN_STATUS[w.lastRun.status]?.label ?? w.lastRun.status}</Badge>
                    <div className="mt-0.5 text-faint"><TimeAgo at={w.lastRun.at} /></div>
                  </>
                ) : (
                  <span className="text-faint">noch nie gelaufen</span>
                )}
              </div>
              {canWrite && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Aktionen für ${w.name}`}><MoreHorizontal /></Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem onSelect={() => setEditing({ id: w.id, draft: { ...w } })}><Pencil /> Bearbeiten</MenuItem>
                    <MenuItem
                      disabled={!props.hasSubmissions}
                      onSelect={() => setConfirmTest(w)}
                    >
                      <FlaskConical /> Mit letzter Antwort testen
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem danger onSelect={() => setConfirmDelete(w)}><Trash2 /> Löschen …</MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </li>
          ))}
        </ul>
      )}

      <RunLog runs={runs} workflows={workflows} canWrite={canWrite} onRefresh={() => void loadRuns()} />

      {editing && (
        <WorkflowEditor
          key={editing.id ?? "new"}
          formId={formId}
          id={editing.id}
          initial={editing.draft}
          fields={fields}
          allowPrivateWebhooks={props.allowPrivateWebhooks}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!confirmTest} onOpenChange={(o) => !o && setConfirmTest(null)}>
        <DialogContent title="Mit der letzten Antwort testen?" description="Die Schritte werden wirklich ausgeführt: E-Mails gehen an die eingetragenen Empfänger – bei „Bestätigung an Einreichende“ auch an die Person, die das Formular ausgefüllt hat. Webhooks werden gesendet. Der Lauf erscheint im Protokoll als Testlauf.">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmTest(null)}>Abbrechen</Button>
            <Button
              variant="primary"
              onClick={() => {
                const w = confirmTest!;
                setConfirmTest(null);
                start(async () => {
                                  const r = await testWorkflowAction(w.id);
                                  if (!r.ok) return void toast.error(r.error);
                                  toast(`Testlauf mit Antwort #${r.data.submissionNumber} gestartet`);
                                  pollRuns();
                                });
              }}
            >
              Testlauf starten
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent title="Automation löschen?" description={`„${confirmDelete?.name}“ und ihr Protokoll werden entfernt. Bereits gesendete E-Mails und Webhooks bleiben natürlich unberührt.`}>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={() => {
                const w = confirmDelete!;
                setConfirmDelete(null);
                start(async () => {
                  const r = await deleteWorkflowAction(w.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast("Automation gelöscht");
                  router.refresh();
                });
              }}
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Protokoll ---------------- */

function RunLog({ runs, workflows, onRefresh, canWrite }: { runs: Run[]; workflows: Workflow[]; onRefresh: () => void; canWrite: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const names = new Map(workflows.map((w) => [w.id, w.name]));
  return (
    <section aria-labelledby="runlog">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="runlog" className="text-[15px] font-semibold">Protokoll</h2>
        <Button size="sm" variant="ghost" onClick={onRefresh}>Aktualisieren</Button>
      </div>
      {runs.length === 0 ? (
        <p className="rounded-lg border border-line bg-paper px-5 py-6 text-center text-[13.5px] text-muted">Noch keine Läufe. Sobald eine Antwort eingeht, siehst du hier jeden Schritt.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg bg-paper shadow-sheet">
          {runs.map((r) => {
            const s = RUN_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
            const expanded = open === r.id;
            return (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <button onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper-2 sm:px-5">
                  <ChevronRight className={cn("size-3.5 shrink-0 text-faint transition-transform", expanded && "rotate-90")} />
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    {names.get(r.workflowId) ?? "Gelöschte Automation"}
                    {r.submissionNumber !== null && <span className="text-muted"> · Antwort #{r.submissionNumber}</span>}
                    {r.branch === "else" && <span className="text-muted"> · Sonst-Zweig</span>}
                    {r.test && <span className="text-muted"> · Testlauf</span>}
                  </span>
                  <span className="shrink-0 text-[12px] text-faint" title={dateTime(r.createdAt)}><TimeAgo at={r.createdAt} /></span>
                </button>
                {expanded && (
                  <ol className="space-y-1.5 bg-paper-2 px-4 py-3 sm:pl-12 sm:pr-5">
                    {r.log.length === 0 && <li className="text-[13px] text-muted">{r.status === "running" ? "Wartet auf den Worker …" : "Keine Schritte ausgeführt."}</li>}
                    {r.log.map((l, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px]">
                        {l.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-ok" /> : <X className="mt-0.5 size-3.5 shrink-0 text-bad" />}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{l.step}</span> <span className="text-ink-2">{l.message}</span>
                          {l.attempt && l.attempt > 1 && <span className="text-faint"> · Versuch {l.attempt}</span>}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-faint">{new Date(l.at).toLocaleTimeString("de-DE")}</span>
                      </li>
                    ))}
                    {canWrite && (r.status === "failed" || r.status === "partial") && (
                      <li className="pt-1">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const res = await retryRunAction(r.id);
                            if (!res.ok) return void toast.error(res.error);
                            toast("Lauf wird erneut ausgeführt");
                            setTimeout(onRefresh, 1500);
                          }}
                        >
                          <RotateCcw /> Erneut ausführen
                        </Button>
                      </li>
                    )}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Editor ---------------- */

const OPS_BY_KIND: Record<string, { value: string; label: string }[]> = {
  choice: [{ value: "eq", label: "ist" }, { value: "neq", label: "ist nicht" }, { value: "empty", label: "ist leer" }, { value: "not_empty", label: "ist ausgefüllt" }],
  multi: [{ value: "contains", label: "enthält" }, { value: "not_contains", label: "enthält nicht" }, { value: "empty", label: "ist leer" }, { value: "not_empty", label: "ist ausgefüllt" }],
  bool: [{ value: "eq", label: "ist" }],
  number: [{ value: "gt", label: "größer als" }, { value: "gte", label: "mindestens" }, { value: "lt", label: "kleiner als" }, { value: "lte", label: "höchstens" }, { value: "eq", label: "gleich" }, { value: "neq", label: "ungleich" }, { value: "empty", label: "ist leer" }, { value: "not_empty", label: "ist ausgefüllt" }],
  date: [{ value: "gt", label: "nach" }, { value: "lt", label: "vor" }, { value: "eq", label: "am" }, { value: "empty", label: "ist leer" }, { value: "not_empty", label: "ist ausgefüllt" }],
  consent: [{ value: "not_empty", label: "erteilt" }, { value: "empty", label: "nicht erteilt" }],
  text: [{ value: "eq", label: "ist" }, { value: "neq", label: "ist nicht" }, { value: "contains", label: "enthält" }, { value: "not_contains", label: "enthält nicht" }, { value: "empty", label: "ist leer" }, { value: "not_empty", label: "ist ausgefüllt" }],
};

function kindOf(type: string) {
  if (type === "dropdown" || type === "single_choice") return "choice";
  if (type === "checkboxes" || type === "multi_select") return "multi";
  if (type === "yes_no") return "bool";
  if (["number", "currency", "rating", "slider", "calculated"].includes(type)) return "number";
  if (type === "date" || type === "datetime") return "date";
  if (type === "consent") return "consent";
  return "text";
}

type Draft = Omit<Workflow, "id" | "lastRun">;

function WorkflowEditor({ formId, id, initial, fields, allowPrivateWebhooks, onClose, onSaved }: { formId: string; id: string | null; initial: Draft; fields: FieldOption[]; allowPrivateWebhooks: boolean; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(() => JSON.parse(JSON.stringify(initial)));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const hasCondition = !!d.condition && d.condition.conditions.length > 0;

  function save() {
    setError(null);
    start(async () => {
      const r = await saveWorkflowAction(formId, id, { ...d, condition: hasCondition ? (d.condition as WorkflowInputT["condition"]) : null, elseSteps: hasCondition ? d.elseSteps : [] });
      if (!r.ok) {
        setError(r.fieldErrors ? `${r.error} ${Object.values(r.fieldErrors).join(" ")}` : r.error);
        return;
      }
      toast(id ? "Automation gespeichert" : "Automation angelegt");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide title={id ? "Automation bearbeiten" : "Neue Automation"} className="max-w-3xl">
        <div className="space-y-6">
          <FormRow label="Name" htmlFor="wf-name">
            <Input id="wf-name" value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
          </FormRow>

          <Section title="Wann" icon={<Zap />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Auslöser" value={d.trigger} onValueChange={(v) => set({ trigger: v as WorkflowTrigger, triggerStatus: v === "submission.status_changed" ? (d.triggerStatus ?? "done") : null })} options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))} />
              {d.trigger === "submission.status_changed" && (
                <Select label="Neuer Status" value={d.triggerStatus ?? "done"} onValueChange={(v) => set({ triggerStatus: v as Status })} options={STATUS.map((s) => ({ value: s.value, label: `auf „${s.label}“` }))} />
              )}
            </div>
          </Section>

          <Section title="Nur wenn" icon={<GitBranch />} optional={!hasCondition}>
            {!hasCondition ? (
              <Button size="sm" variant="ghost" disabled={fields.length === 0} onClick={() => set({ condition: { match: "all", conditions: [{ fieldId: fields[0].id, operator: OPS_BY_KIND[kindOf(fields[0].type)][0].value, value: "" }] } })}>
                <Plus /> Bedingung hinzufügen
              </Button>
            ) : (
              <ConditionEditor fields={fields} value={d.condition!} onChange={(c) => set({ condition: c.conditions.length ? c : null })} />
            )}
          </Section>

          <Section title={hasCondition ? "Dann" : "Dann"} icon={<ChevronRight />}>
            <StepsEditor steps={d.steps} onChange={(steps) => set({ steps })} fields={fields} allowPrivateWebhooks={allowPrivateWebhooks} />
          </Section>

          {hasCondition && (
            <Section title="Sonst" icon={<GitBranch />} optional={d.elseSteps.length === 0}>
              <StepsEditor steps={d.elseSteps} onChange={(elseSteps) => set({ elseSteps })} fields={fields} allowPrivateWebhooks={allowPrivateWebhooks} emptyHint="Wenn die Bedingung nicht zutrifft, passiert nichts." />
            </Section>
          )}

          {error && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-[13.5px] text-bad">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-[13.5px]">
              <Switch checked={d.enabled} onCheckedChange={(enabled) => set({ enabled })} label="Aktiv" />
              {d.enabled ? "Aktiv" : "Pausiert"}
            </label>
            <div className="flex gap-2">
              <Button onClick={onClose}>Abbrechen</Button>
              <Button variant="primary" onClick={save} loading={pending}>{id ? "Speichern" : "Anlegen"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children, optional }: { title: string; icon: ReactNode; children: ReactNode; optional?: boolean }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wider text-muted uppercase [&_svg]:size-3.5">
        {icon}
        {title}
        {optional && <span className="font-normal normal-case tracking-normal text-faint">· optional</span>}
      </h3>
      {children}
    </section>
  );
}

function ConditionEditor({ fields, value, onChange }: { fields: FieldOption[]; value: WorkflowCondition; onChange: (c: WorkflowCondition) => void }) {
  const update = (i: number, patch: Partial<WorkflowCondition["conditions"][number]>) => onChange({ ...value, conditions: value.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-2 rounded-md border border-line bg-paper-2 p-3">
      {value.conditions.length > 1 && (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span>Es muss</span>
          <Select label="Verknüpfung" className="h-8 w-auto" value={value.match} onValueChange={(m) => onChange({ ...value, match: m as "all" | "any" })} options={[{ value: "all", label: "jede" }, { value: "any", label: "mindestens eine" }]} />
          <span>Bedingung zutreffen.</span>
        </div>
      )}
      {value.conditions.map((c, i) => {
        const f = fields.find((x) => x.id === c.fieldId);
        const kind = kindOf(f?.type ?? "short_text");
        const ops = OPS_BY_KIND[kind];
        const needsValue = !["empty", "not_empty"].includes(c.operator);
        return (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <Select
              label="Feld"
              className="h-8"
              value={f ? c.fieldId : undefined}
              placeholder="Gelöschtes Feld – bitte wählen"
              onValueChange={(fid) => {
                const nf = fields.find((x) => x.id === fid)!;
                update(i, { fieldId: fid, operator: OPS_BY_KIND[kindOf(nf.type)][0].value, value: kindOf(nf.type) === "bool" ? true : "" });
              }}
              options={fields.map((x) => ({ value: x.id, label: x.label }))}
            />
            <Select label="Vergleich" className="h-8" value={ops.some((o) => o.value === c.operator) ? c.operator : ops[0].value} onValueChange={(op) => update(i, { operator: op })} options={ops} />
            {needsValue ? (
              kind === "bool" ? (
                <Select label="Wert" className="h-8" value={String(c.value === true || c.value === "true")} onValueChange={(v) => update(i, { value: v === "true" })} options={[{ value: "true", label: "Ja" }, { value: "false", label: "Nein" }]} />
              ) : (kind === "choice" || kind === "multi") && f?.options?.length ? (
                <Select label="Wert" className="h-8" value={typeof c.value === "string" && c.value ? c.value : undefined} placeholder="Antwort wählen" onValueChange={(v) => update(i, { value: v })} options={f.options.map((o) => ({ value: o.value, label: o.label }))} />
              ) : (
                <Input aria-label="Vergleichswert" className="h-8" type={kind === "date" ? "date" : "text"} inputMode={kind === "number" ? "decimal" : undefined} value={String(c.value ?? "")} onChange={(e) => update(i, { value: kind === "number" && e.target.value !== "" && !Number.isNaN(Number(e.target.value.replace(",", "."))) ? Number(e.target.value.replace(",", ".")) : e.target.value })} />
              )
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button size="icon-sm" variant="ghost" aria-label="Bedingung entfernen" onClick={() => onChange({ ...value, conditions: value.conditions.filter((_, j) => j !== i) })}>
              <X />
            </Button>
          </div>
        );
      })}
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, conditions: [...value.conditions, { fieldId: fields[0].id, operator: OPS_BY_KIND[kindOf(fields[0].type)][0].value, value: "" }] })}>
        <Plus /> Weitere Bedingung
      </Button>
    </div>
  );
}

function StepsEditor({ steps, onChange, fields, allowPrivateWebhooks, emptyHint }: { steps: WorkflowStep[]; onChange: (s: WorkflowStep[]) => void; fields: FieldOption[]; allowPrivateWebhooks: boolean; emptyHint?: string }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {steps.length === 0 && emptyHint && <p className="text-[13px] text-muted">{emptyHint}</p>}
      {steps.map((s, i) => (
        <div key={s.id} className="rounded-md border border-line bg-paper">
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-2">
            <span className="grid size-6 place-items-center rounded-sm bg-stamp-soft text-stamp [&_svg]:size-3.5">{STEP_META[s.type].icon}</span>
            <span className="flex-1 text-[13.5px] font-medium">
              <span className="mr-1.5 font-mono text-[11.5px] text-faint">{i + 1}</span>
              {STEP_META[s.type].label}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Nach unten" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Schritt entfernen" onClick={() => onChange(steps.filter((x) => x.id !== s.id))}><Trash2 /></Button>
          </div>
          <div className="p-3">
            <StepFields step={s} fields={fields} allowPrivateWebhooks={allowPrivateWebhooks} onChange={(ns) => onChange(steps.map((x) => (x.id === s.id ? ns : x)))} />
          </div>
        </div>
      ))}
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="secondary"><Plus /> Schritt hinzufügen</Button>
        </MenuTrigger>
        <MenuContent align="start" className="w-72">
          {(Object.keys(STEP_META) as WorkflowStep["type"][]).map((t) => (
            <MenuItem key={t} onSelect={() => onChange([...steps, newStep(t)])}>
              {STEP_META[t].icon}
              <span className="flex flex-col">
                <span>{STEP_META[t].label}</span>
                <span className="text-[12px] text-muted">{STEP_META[t].hint}</span>
              </span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}

const BUILTINS = [
  { key: "plica.nummer", label: "Nummer" },
  { key: "plica.formular", label: "Formular" },
  { key: "plica.antworten", label: "Alle Angaben" },
  { key: "plica.link", label: "Link zur Antwort" },
  { key: "plica.datum", label: "Datum" },
  { key: "plica.status", label: "Status" },
];

function Placeholders({ fields, onInsert }: { fields: FieldOption[]; onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {[...BUILTINS, ...fields.map((f) => ({ key: f.key, label: f.label }))].map((p) => (
        <button key={p.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(`{{${p.key}}}`)} title={`{{${p.key}}} einfügen`} className="max-w-48 truncate rounded-xs border border-line bg-paper-2 px-1.5 py-0.5 text-[11.5px] text-ink-2 hover:border-stamp-line hover:text-stamp">
          {p.label}
        </button>
      ))}
    </div>
  );
}

function useInsert<T extends HTMLInputElement | HTMLTextAreaElement>(value: string, onChange: (v: string) => void) {
  const ref = useRef<T>(null);
  const insert = (token: string) => {
    const el = ref.current;
    const startPos = el?.selectionStart ?? value.length;
    const endPos = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, startPos) + token + value.slice(endPos));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(startPos + token.length, startPos + token.length);
    });
  };
  return { ref, insert };
}

function MailFields({ subject, body, onSubject, onBody, fields }: { subject: string; body: string; onSubject: (s: string) => void; onBody: (s: string) => void; fields: FieldOption[] }) {
  const [focus, setFocus] = useState<"subject" | "body">("body");
  const { ref: subjectRef, insert: insertSubject } = useInsert<HTMLInputElement>(subject, onSubject);
  const { ref: bodyRef, insert: insertBody } = useInsert<HTMLTextAreaElement>(body, onBody);
  return (
    <>
      <FormRow label="Betreff">
        <Input aria-label="Betreff" ref={subjectRef} value={subject} onFocus={() => setFocus("subject")} onChange={(e) => onSubject(e.target.value)} />
      </FormRow>
      <FormRow label="Text">
        <Textarea aria-label="Text der E-Mail" ref={bodyRef} rows={6} value={body} onFocus={() => setFocus("body")} onChange={(e) => onBody(e.target.value)} className="font-[inherit]" />
      </FormRow>
      <div className="space-y-1">
        <div className="text-[12px] text-muted">Platzhalter einfügen in {focus === "subject" ? "Betreff" : "Text"}:</div>
        <Placeholders fields={fields} onInsert={(t) => (focus === "subject" ? insertSubject(t) : insertBody(t))} />
      </div>
    </>
  );
}

function StepFields({ step, onChange, fields, allowPrivateWebhooks }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; fields: FieldOption[]; allowPrivateWebhooks: boolean }) {
  switch (step.type) {
    case "email": {
      const emailFields = fields.filter((f) => f.type === "email");
      return (
        <div className="space-y-3">
          <FormRow label="An" hint={emailFields.length ? `Mehrere Adressen mit Komma trennen. Für die Adresse aus der Antwort: ${emailFields.map((f) => `{{${f.key}}}`).join(", ")}` : "Mehrere Adressen mit Komma trennen."}>
            <Input aria-label="Empfänger" value={step.to} placeholder="kanzlei@beispiel.de" onChange={(e) => onChange({ ...step, to: e.target.value })} />
          </FormRow>
          <MailFields subject={step.subject} body={step.body} onSubject={(subject) => onChange({ ...step, subject })} onBody={(body) => onChange({ ...step, body })} fields={fields} />
          <label className="flex items-center gap-2 text-[13.5px]">
            <Checkbox checked={!!step.attachPdf} onCheckedChange={(attachPdf) => onChange({ ...step, attachPdf })} />
            PDF der Antwort anhängen
          </label>
        </div>
      );
    }
    case "confirmation":
      return (
        <div className="space-y-3">
          {!fields.some((f) => f.type === "email") && (
            <p className="flex items-start gap-2 rounded-sm bg-warn-soft px-2.5 py-2 text-[12.5px] text-warn"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Das Formular hat kein E-Mail-Feld. Ohne Adresse wird dieser Schritt übersprungen.</p>
          )}
          <MailFields subject={step.subject} body={step.body} onSubject={(subject) => onChange({ ...step, subject })} onBody={(body) => onChange({ ...step, body })} fields={fields} />
          <label className="flex items-center gap-2 text-[13.5px]">
            <Checkbox checked={!!step.attachPdf} onCheckedChange={(attachPdf) => onChange({ ...step, attachPdf })} />
            PDF der Angaben anhängen
          </label>
        </div>
      );
    case "webhook":
      return (
        <div className="space-y-2">
          <FormRow label="Adresse (URL)" hint={`POST mit JSON, signiert mit dem Webhook-Geheimnis des Workspace (Einstellungen → API und Webhooks).${allowPrivateWebhooks ? "" : " Interne Netze sind gesperrt."}`}>
            <Input aria-label="Webhook-Adresse" value={step.url} placeholder="https://system.beispiel.de/plica-webhook" inputMode="url" onChange={(e) => onChange({ ...step, url: e.target.value })} className="font-mono text-[13px]" />
          </FormRow>
        </div>
      );
    case "set_status":
      return (
        <FormRow label="Neuer Status">
          <Select value={step.status} onValueChange={(v) => onChange({ ...step, status: v as Status })} options={STATUS} />
        </FormRow>
      );
    case "approval":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormRow label="Aufgabe">
            <Input aria-label="Titel der Freigabe" value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })} />
          </FormRow>
          <FormRow label="Wer entscheidet">
            <Select value={step.assigneeRole} onValueChange={(v) => onChange({ ...step, assigneeRole: v as typeof step.assigneeRole })} options={ROLES} />
          </FormRow>
          <p className="text-[12.5px] text-muted sm:col-span-2">Die Antwort wechselt auf „In Prüfung“. Nach der Entscheidung starten Automationen mit dem Auslöser „Freigabe erteilt“ bzw. „abgelehnt“.</p>
        </div>
      );
    case "pdf":
      return <p className="text-[13px] text-muted">Erzeugt ein PDF nach der PDF-Vorlage dieses Formulars und legt es als Datei an der Antwort ab.</p>;
  }
}
