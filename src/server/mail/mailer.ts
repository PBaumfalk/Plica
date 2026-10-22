/**
 * E-Mail-Versand über SMTP (SMTP_URL). Ohne Konfiguration wird nichts
 * „simuliert“ – sendMail wirft eine verständliche Fehlermeldung, die im
 * Workflow-Protokoll erscheint.
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
}

let transport: Transporter | null = null;

export function mailConfigured(): boolean {
  return !!config().SMTP_URL;
}

function transporter(): Transporter {
  const url = config().SMTP_URL;
  if (!url) throw new Error("E-Mail-Versand ist nicht eingerichtet (SMTP_URL fehlt).");
  transport ??= nodemailer.createTransport(url);
  return transport;
}

/** Kopfzeilen-Injection verhindern: keine Zeilenumbrüche in Betreff/Adressen. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export async function sendMail(input: MailInput): Promise<{ messageId: string }> {
  const to = (Array.isArray(input.to) ? input.to : [input.to]).map(oneLine).filter(Boolean);
  if (to.length === 0) throw new Error("Keine Empfängeradresse angegeben.");
  const info = await transporter().sendMail({
    from: config().MAIL_FROM,
    to,
    subject: oneLine(input.subject).slice(0, 300),
    text: input.text,
    html: input.html,
    replyTo: input.replyTo ? oneLine(input.replyTo) : undefined,
    attachments: input.attachments,
  });
  return { messageId: String(info.messageId ?? "") };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Schlichtes, gut lesbares HTML-Layout für alle PLICA-Mails. */
export function mailLayout(opts: { title: string; bodyHtml: string; footer?: string }): string {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#eceef0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1c21">
<div style="max-width:600px;margin:0 auto;padding:32px 16px">
<div style="background:#fcfcfb;border-radius:12px;padding:28px 28px 24px;box-shadow:0 1px 3px rgba(17,20,28,.08)">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:500;font-size:22px;line-height:1.25">${escapeHtml(opts.title)}</h1>
${opts.bodyHtml}
</div>
<p style="margin:16px 4px 0;font-size:12px;color:#5b626d">${escapeHtml(opts.footer ?? "Gesendet von PLICA")}</p>
</div></body></html>`;
}
