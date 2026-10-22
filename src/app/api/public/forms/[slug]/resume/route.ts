import { config } from "@/server/config";
import { json, problem, readJson } from "@/server/lib/http";
import { rateLimit } from "@/server/lib/ratelimit";
import { clientIp, ipKey, sameOrigin } from "@/server/lib/request";
import { escapeHtml, mailConfigured, mailLayout, sendMail } from "@/server/mail/mailer";
import { deleteResume, saveResume } from "@/server/resume/service";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

export async function POST(req: Request, ctx: RouteContext<"/api/public/forms/[slug]/resume">) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  const ip = ipKey(clientIp(req.headers));
  if (!rateLimit(`resume:${ip}`, 20, 60_000).ok) return problem(429, "Zu viele Anfragen. Bitte warten Sie einen Moment.");
  const body = await readJson<{ token?: string; answers?: unknown; pageId?: string; resume?: string; email?: string }>(req, 1_500_000);
  if (!body) return problem(400, "Ungültige Anfrage.");
  const r = await saveResume(slug, body);
  if (!r.ok) return problem(r.status, r.error);
  const link = `${config().publicUrl}/r/${r.token}`;

  let emailed = false;
  if (typeof body.email === "string" && body.email.trim()) {
    const to = body.email.trim().slice(0, 254);
    if (!EMAIL.test(to)) return problem(422, "Bitte eine gültige E-Mail-Adresse angeben.");
    if (!mailConfigured()) return problem(503, "Der E-Mail-Versand ist auf diesem Server nicht eingerichtet. Bitte kopieren Sie den Link.");
    // Versand an fremde Adressen begrenzen (Missbrauch als Mailschleuder)
    if (!rateLimit(`resume-mail:${ip}`, 3, 3600_000).ok) return problem(429, "Es wurden bereits mehrere Links versendet. Bitte kopieren Sie den Link.");
    const date = r.expiresAt.toLocaleDateString("de-DE", { dateStyle: "long" });
    await sendMail({
      to,
      subject: "Ihr Link zum Fortsetzen des Formulars",
      text: `Sie können das Formular hier fortsetzen:\n${link}\n\nDer Link ist bis ${date} gültig. Bitte geben Sie ihn nicht weiter – wer ihn kennt, sieht Ihre bisherigen Angaben.`,
      html: mailLayout({
        title: "Formular später fortsetzen",
        bodyHtml: `<p style="font-size:15px;line-height:1.6">Ihre bisherigen Angaben sind gespeichert. Mit diesem Link machen Sie dort weiter, wo Sie aufgehört haben:</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4636c9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Formular fortsetzen</a></p><p style="font-size:13px;color:#5b626d;line-height:1.6">Gültig bis ${escapeHtml(date)}. Bitte geben Sie den Link nicht weiter – wer ihn kennt, sieht Ihre bisherigen Angaben.</p>`,
      }),
    });
    emailed = true;
  }
  return json({ resume: r.token, link, expiresAt: r.expiresAt.toISOString(), emailed });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/public/forms/[slug]/resume">) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  const body = await readJson<{ resume?: string }>(req, 1_000);
  if (body?.resume) await deleteResume(slug, body.resume);
  return new Response(null, { status: 204 });
}
