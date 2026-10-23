/**
 * Workflow-Ausführung. Ein Job „workflow.run“ beschreibt ein Ereignis
 * (Auslöser + Antwort); alle passenden, aktiven Workflows des Formulars
 * laufen nacheinander. Jeder Schritt läuft über ctx.step genau einmal.
 */
import { logError } from "../lib/log";
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { answerRows, formatValue } from "@/lib/forms/format";
import { evalCondition, interpolate } from "@/lib/forms/logic";
import { fieldIndex, type FormDefinition } from "@/lib/forms/schema";
import { config } from "../config";
import { db, schema } from "../db";
import type { WorkflowStep, WorkflowTrigger } from "../db/schema";
import { decrypt, sha256, shortId } from "../lib/crypto";
import { SafeFetchError, safeFetch } from "../lib/safefetch";
import { escapeHtml, mailConfigured, mailLayout, sendMail, type MailAttachment } from "../mail/mailer";
import { PermanentError, type JobContext } from "../queue/runner";
import { putObject, storageKey } from "../storage/s3";
import { signatureHeader } from "../webhooks/sign";
import { emitStatusChanged } from "./events";

export interface WorkflowPayload {
  trigger: WorkflowTrigger;
  submissionId: string;
  status?: string;
  approvalId?: string;
  depth?: number;
  /** Ausgelöst über „Mit letzter Antwort testen“. */
  test?: boolean;
  /** Nur diesen Workflow ausführen (Testlauf, Wiederholung). */
  workflowId?: string;
  /** Diesen fehlgeschlagenen Lauf fortsetzen: erledigte Schritte werden übersprungen. */
  retryRunId?: string;
}

const STATUS_LABEL: Record<string, string> = { new: "Neu", in_review: "In Prüfung", approved: "Freigegeben", rejected: "Abgelehnt", done: "Erledigt", spam: "Spam" };

export async function loadSubmissionContext(submissionId: string) {
  const sub = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, submissionId) });
  if (!sub) return null;
  const form = await db.query.forms.findFirst({ where: eq(schema.forms.id, sub.formId) });
  const version = await db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, sub.versionId) });
  const workspace = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, sub.workspaceId) });
  if (!form || !version || !workspace) return null;
  return { sub, form, def: version.definition as FormDefinition, workspace, version };
}

export type SubmissionContext = NonNullable<Awaited<ReturnType<typeof loadSubmissionContext>>>;

export function responseLink(c: SubmissionContext) {
  return `${config().APP_URL}/formulare/${c.form.id}/antworten/${c.sub.id}`;
}

/** Text mit {{feld}}- und {{plica.*}}-Platzhaltern füllen. */
export function fillText(text: string, c: SubmissionContext): string {
  const data = c.sub.data as Record<string, unknown>;
  const builtins: Record<string, string> = {
    nummer: String(c.sub.number),
    formular: c.def.title,
    link: responseLink(c),
    status: STATUS_LABEL[c.sub.status] ?? c.sub.status,
    datum: c.sub.submittedAt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }),
    antworten: answerRows(c.def, data).map((r) => `${r.label}: ${r.text}`).join("\n"),
  };
  const withBuiltins = text.replace(/\{\{\s*plica\.([a-z]+)\s*\}\}/g, (_, k: string) => builtins[k] ?? "");
  return interpolate(withBuiltins, c.def, data, formatValue);
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    // URLs nach dem Escapen klickbar machen (z. B. {{plica.link}})
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(p).replace(/https?:\/\/[^\s<&]+/g, (u) => `<a href="${u}" style="color:#0b5c66">${u}</a>`).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function summaryHtml(c: SubmissionContext): string {
  const rows = answerRows(c.def, c.sub.data as Record<string, unknown>);
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map((r) => `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #dcdfe4;color:#5b626d;vertical-align:top;width:40%">${escapeHtml(r.label)}</td><td style="padding:8px 0;border-top:1px solid #dcdfe4;white-space:pre-line">${escapeHtml(r.text)}</td></tr>`)
    .join("")}</table>`;
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Empfängerliste: feste Adressen und {{schluessel}} eines E-Mail-Feldes. */
export function resolveRecipients(spec: string, c: SubmissionContext): string[] {
  const out = new Set<string>();
  for (const part of spec.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/.exec(part);
    if (m) {
      const f = [...fieldIndex(c.def).values()].find((e) => e.field.key === m[1])?.field;
      const v = f ? (c.sub.data as Record<string, unknown>)[f.id] : undefined;
      if (typeof v === "string" && EMAIL.test(v)) out.add(v.toLowerCase());
    } else if (EMAIL.test(part)) out.add(part.toLowerCase());
  }
  return [...out];
}

async function pdfAttachment(c: SubmissionContext): Promise<MailAttachment> {
  const { renderSubmissionPdf } = await import("../pdf");
  const { buffer, filename } = await renderSubmissionPdf(c.workspace.id, c.sub.id);
  return { filename, content: buffer, contentType: "application/pdf" };
}

type StepOutcome = { ok: boolean; message: string };

async function executeStep(step: WorkflowStep, c: SubmissionContext, payload: WorkflowPayload, runId: string, once: <T>(part: string, fn: () => Promise<T>) => Promise<T> = (_p, fn) => fn()): Promise<StepOutcome> {
  switch (step.type) {
    case "email": {
      const to = resolveRecipients(step.to, c);
      if (to.length === 0) throw new PermanentError("Keine gültige Empfängeradresse.");
      if (!mailConfigured()) throw new PermanentError("E-Mail-Versand ist nicht eingerichtet (SMTP_URL fehlt).");
      const body = fillText(step.body, c);
      const attachments = step.attachPdf ? [await pdfAttachment(c)] : undefined;
      await sendMail({ to, subject: `${payload.test ? "[Test] " : ""}${fillText(step.subject, c)}`, text: body, html: mailLayout({ title: fillText(step.subject, c), bodyHtml: textToHtml(body) }), attachments, replyTo: c.sub.respondentEmail ?? undefined });
      return { ok: true, message: `E-Mail an ${to.join(", ")} gesendet.` };
    }
    case "confirmation": {
      const to = c.sub.respondentEmail;
      if (!to) return { ok: true, message: "Übersprungen: Die Antwort enthält keine E-Mail-Adresse." };
      if (!mailConfigured()) throw new PermanentError("E-Mail-Versand ist nicht eingerichtet (SMTP_URL fehlt).");
      const body = fillText(step.body, c);
      const attachments = step.attachPdf ? [await pdfAttachment(c)] : undefined;
      await sendMail({ to, subject: `${payload.test ? "[Test] " : ""}${fillText(step.subject, c)}`, text: body, html: mailLayout({ title: fillText(step.subject, c), bodyHtml: textToHtml(body), footer: c.workspace.name }), attachments });
      return { ok: true, message: `Bestätigung an ${to} gesendet.` };
    }
    case "webhook": {
      const body = JSON.stringify({
        event: payload.trigger,
        // Testläufe aus der Oberfläche: Empfänger sollten keine echten Datensätze anlegen
        ...(payload.test ? { test: true } : {}),
        deliveredAt: new Date().toISOString(),
        form: { id: c.form.id, slug: c.form.slug, title: c.def.title, version: c.version.number },
        submission: {
          id: c.sub.id,
          number: c.sub.number,
          status: c.sub.status,
          submittedAt: c.sub.submittedAt.toISOString(),
          answers: Object.fromEntries(answerRows(c.def, c.sub.data as Record<string, unknown>).map((r) => [r.field.key, r.value])),
          tags: c.sub.tags,
        },
      });
      const secret = decrypt(c.workspace.webhookSecret, "webhook");
      // Gleiche Zustellungs-ID über alle Versuche → Empfänger kann deduplizieren
      const delivery = `${runId}:${step.id}`;
      let res;
      try {
        res = await safeFetch(step.url, {
          method: "POST",
          body,
          allowPrivate: config().WEBHOOK_ALLOW_PRIVATE,
          headers: { "content-type": "application/json", "x-plica-signature": signatureHeader(secret, body), "x-plica-delivery": delivery, "x-plica-event": payload.trigger, ...(payload.test ? { "x-plica-test": "1" } : {}) },
        });
      } catch (e) {
        if (e instanceof SafeFetchError && !e.retryable) throw new PermanentError(e.message);
        throw e;
      }
      if (res.status >= 200 && res.status < 300) return { ok: true, message: `Webhook zugestellt (HTTP ${res.status}).` };
      if (res.status === 429 || res.status >= 500) throw new StepError(`Webhook-Ziel antwortete mit HTTP ${res.status}.`);
      throw new PermanentError(`Webhook-Ziel lehnte ab (HTTP ${res.status}).`);
    }
    case "set_status": {
      if (c.sub.status === step.status) return { ok: true, message: `Status war bereits „${STATUS_LABEL[step.status]}“.` };
      await emitStatusChanged({ submissionId: c.sub.id, from: c.sub.status, to: step.status, userId: null, depth: (payload.depth ?? 0) + 1, source: "workflow" });
      c.sub.status = step.status;
      return { ok: true, message: `Status auf „${STATUS_LABEL[step.status]}“ gesetzt.` };
    }
    case "approval": {
      // Eigener Teilschritt: scheitert danach die Benachrichtigung, entsteht beim
      // nächsten Versuch keine zweite Freigabe.
      const a = await once("approval", async () => {
        const [row] = await db
          .insert(schema.approvals)
          .values({ workspaceId: c.workspace.id, submissionId: c.sub.id, workflowRunId: runId, title: fillText(step.title, c), assigneeRole: step.assigneeRole })
          .returning({ id: schema.approvals.id, title: schema.approvals.title });
        return row;
      });
      if (c.sub.status === "new") {
        await emitStatusChanged({ submissionId: c.sub.id, from: c.sub.status, to: "in_review", userId: null, depth: (payload.depth ?? 0) + 1, source: "workflow" });
        c.sub.status = "in_review";
      }
      let note = "";
      if (mailConfigured()) {
        const rank = { viewer: 1, reviewer: 2, editor: 3, admin: 4, owner: 5 } as const;
        const roles = (Object.keys(rank) as (keyof typeof rank)[]).filter((r) => rank[r] >= rank[step.assigneeRole]);
        const people = await db
          .select({ email: schema.users.email })
          .from(schema.memberships)
          .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
          .where(and(eq(schema.memberships.workspaceId, c.workspace.id), inArray(schema.memberships.role, roles)));
        if (people.length) {
          await sendMail({
            to: people.map((p) => p.email),
            subject: `${payload.test ? "[Test] " : ""}Freigabe erbeten: ${a.title}`,
            text: `${a.title}\n\nAntwort #${c.sub.number} zu „${c.def.title}“ wartet auf deine Entscheidung.\n${config().APP_URL}/freigaben`,
            html: mailLayout({ title: `Freigabe erbeten: ${a.title}`, bodyHtml: `${textToHtml(`Antwort #${c.sub.number} zu „${c.def.title}“ wartet auf deine Entscheidung.`)}<p><a href="${escapeHtml(`${config().APP_URL}/freigaben`)}" style="color:#0b5c66">Zu den Freigaben</a></p>${summaryHtml(c)}` }),
          });
          note = ` ${people.length} Person(en) benachrichtigt.`;
        }
      }
      return { ok: true, message: `Freigabeaufgabe „${a.title}“ erstellt.${note}` };
    }
    case "pdf": {
      const { renderSubmissionPdf } = await import("../pdf");
      const { buffer, filename } = await renderSubmissionPdf(c.workspace.id, c.sub.id);
      const id = shortId(24);
      await putObject(storageKey(c.workspace.id, id), buffer, "application/pdf");
      await db.insert(schema.files).values({
        id,
        workspaceId: c.workspace.id,
        formId: c.form.id,
        submissionId: c.sub.id,
        kind: "pdf",
        name: filename,
        mime: "application/pdf",
        size: buffer.length,
        sha256: sha256(buffer),
        storageKey: storageKey(c.workspace.id, id),
        status: "clean",
        meta: { generatedBy: "workflow", runId },
      });
      return { ok: true, message: `PDF „${filename}“ erzeugt und an der Antwort abgelegt.` };
    }
  }
}

function conditionMatches(cond: (typeof schema.workflows.$inferSelect)["condition"], c: SubmissionContext): boolean {
  if (!cond || cond.conditions.length === 0) return true;
  const data = c.sub.data as Record<string, unknown>;
  const results = cond.conditions.map((x) =>
    evalCondition({ fieldId: x.fieldId, operator: x.operator as never, value: x.value }, x.fieldId === "plica.status" ? c.sub.status : data[x.fieldId]),
  );
  return cond.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/** Fehler mit bereits verständlicher Meldung, der wiederholt werden darf. */
export class StepError extends Error {}

/** Nutzerverständliche Meldung; interne Details (Pfade, Stacks) nur ins Server-Log. */
export function friendlyError(e: unknown): string {
  if (e instanceof PermanentError || e instanceof StepError || e instanceof SafeFetchError) return e.message;
  const code = (e as { code?: string; responseCode?: number })?.code;
  const smtp = (e as { responseCode?: number })?.responseCode;
  if (code && /^(ECONNREFUSED|ETIMEDOUT|ECONNECTION|EAUTH|ESOCKET|EENVELOPE|EMESSAGE|EDNS)$/.test(code)) return `E-Mail-Versand fehlgeschlagen (${code}${smtp ? `, SMTP ${smtp}` : ""}).`;
  logError("workflow", e);
  return "Technischer Fehler. Details stehen im Server-Log.";
}

type LogEntry = { at: string; step: string; ok: boolean; message: string; attempt?: number };

async function appendLog(runId: string, entry: LogEntry) {
  const run = await db.query.workflowRuns.findFirst({ where: eq(schema.workflowRuns.id, runId), columns: { log: true } });
  await db.update(schema.workflowRuns).set({ log: [...(run?.log ?? []), entry] }).where(eq(schema.workflowRuns.id, runId));
}

export const STEP_LABEL: Record<WorkflowStep["type"], string> = {
  email: "E-Mail senden",
  confirmation: "Bestätigung senden",
  webhook: "Webhook auslösen",
  set_status: "Status ändern",
  approval: "Freigabe anfordern",
  pdf: "PDF erzeugen",
};

export async function runWorkflowJob(payload: WorkflowPayload, ctx: JobContext): Promise<void> {
  const c = await loadSubmissionContext(payload.submissionId);
  if (!c) return; // Antwort inzwischen gelöscht – nichts zu tun
  const flows = await db.query.workflows.findMany({
    where: and(eq(schema.workflows.formId, c.form.id), eq(schema.workflows.trigger, payload.trigger), ...(payload.workflowId ? [eq(schema.workflows.id, payload.workflowId)] : [eq(schema.workflows.enabled, true)])),
    orderBy: (w, { asc }) => asc(w.createdAt),
  });
  let retryNeeded: Error | null = null;

  for (const wf of flows) {
    if (payload.trigger === "submission.status_changed" && wf.triggerStatus && wf.triggerStatus !== payload.status) continue;
    const runKey = `wf:${wf.id}:run`;
    const runId = await ctx.step(runKey, async () => {
      if (payload.retryRunId) {
        // Denselben Lauf fortsetzen statt neu zu beginnen – nur wenn er wirklich fehlgeschlagen ist
        const [again] = await db
          .update(schema.workflowRuns)
          .set({ status: "running", finishedAt: null })
          .where(and(eq(schema.workflowRuns.id, payload.retryRunId), eq(schema.workflowRuns.workflowId, wf.id), inArray(schema.workflowRuns.status, ["failed", "partial"])))
          .returning({ id: schema.workflowRuns.id, doneSteps: schema.workflowRuns.doneSteps });
        if (!again) return null;
        await appendLog(again.id, { at: new Date().toISOString(), step: "Erneuter Versuch", ok: true, message: again.doneSteps.length ? `Bereits erledigte Schritte (${again.doneSteps.length}) werden übersprungen.` : "Alle Schritte werden erneut ausgeführt." });
        return again.id;
      }
      const branch = conditionMatches(wf.condition, c) ? "then" : "else";
      // Bedingung nicht erfüllt und kein Sonst-Zweig: nichts zu tun – kein Lauf im Verlauf
      if (branch === "else" && wf.elseSteps.length === 0) return null;
      const [run] = await db
        .insert(schema.workflowRuns)
        // Testläufe bleiben im Protokoll als solche erkennbar
        .values({ workspaceId: c.workspace.id, workflowId: wf.id, submissionId: c.sub.id, trigger: payload.test ? `test:${payload.trigger}` : payload.trigger, branch })
        .returning({ id: schema.workflowRuns.id });
      return run.id;
    });
    if (!runId) continue;
    const run = await db.query.workflowRuns.findFirst({ where: eq(schema.workflowRuns.id, runId) });
    if (!run || run.status !== "running") continue;
    const steps = run.branch === "else" ? wf.elseSteps : wf.steps;
    let failed = 0;
    let ok = 0;
    let pending = false;

    for (const step of steps) {
      const key = `wf:${wf.id}:step:${step.id}`;
      if (run.doneSteps.includes(step.id)) {
        ok++;
        continue;
      }
      if (ctx.done(key)) {
        const prev = ctx.get<{ ok: boolean }>(key);
        if (prev?.ok) ok++;
        else failed++;
        continue;
      }
      try {
        const out = await executeStep(step, c, payload, runId, (part, fn) => ctx.step(`${key}:${part}`, fn));
        await ctx.step(key, async () => {
          await db
            .update(schema.workflowRuns)
            .set({ doneSteps: sql`${schema.workflowRuns.doneSteps} || ${JSON.stringify([step.id])}::jsonb` })
            .where(eq(schema.workflowRuns.id, runId));
          return { ok: true };
        });
        await appendLog(runId, { at: new Date().toISOString(), step: STEP_LABEL[step.type], ok: true, message: out.message, attempt: ctx.job.attempts });
        ok++;
      } catch (e) {
        const message = friendlyError(e);
        const permanent = e instanceof PermanentError || ctx.lastAttempt;
        await appendLog(runId, {
          at: new Date().toISOString(),
          step: STEP_LABEL[step.type],
          ok: false,
          message: permanent ? message : `${message} Neuer Versuch folgt automatisch.`,
          attempt: ctx.job.attempts,
        });
        if (permanent) {
          await ctx.step(key, async () => ({ ok: false }));
          failed++;
        } else {
          // Restliche Schritte erst nach erfolgreicher Wiederholung – Reihenfolge bleibt erhalten.
          retryNeeded = new StepError(message);
          pending = true;
          break;
        }
      }
    }
    if (!pending) {
      const status = failed === 0 ? "succeeded" : ok === 0 ? "failed" : "partial";
      await db.update(schema.workflowRuns).set({ status, finishedAt: new Date() }).where(eq(schema.workflowRuns.id, runId));
    }
  }
  if (retryNeeded) throw retryNeeded;
}

export async function notifySubmission(submissionId: string, ctx: JobContext): Promise<void> {
  const c = await loadSubmissionContext(submissionId);
  if (!c || c.form.notifyEmails.length === 0) return;
  if (!mailConfigured()) throw new PermanentError("E-Mail-Versand ist nicht eingerichtet (SMTP_URL fehlt).");
  await ctx.step("notify:sent", async () => {
    const title = `Neue Antwort #${c.sub.number}: ${c.def.title}`;
    const link = responseLink(c);
    const text = `${title}\n\n${answerRows(c.def, c.sub.data as Record<string, unknown>).map((r) => `${r.label}: ${r.text}`).join("\n")}\n\nIn PLICA öffnen: ${link}`;
    await sendMail({
      to: c.form.notifyEmails,
      subject: title,
      text,
      html: mailLayout({ title, bodyHtml: `${summaryHtml(c)}<p style="margin:20px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b5c66;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px">In PLICA öffnen</a></p>` }),
      replyTo: c.sub.respondentEmail ?? undefined,
    });
    return true;
  });
}

