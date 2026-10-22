import { clientIp, ipKey, sameOrigin } from "@/server/lib/request";
import { problem, json, readJson } from "@/server/lib/http";
import { rateLimit } from "@/server/lib/ratelimit";
import { submit, type SubmitInput } from "@/server/submissions/submit";
import { logError } from "@/server/lib/log";

export async function POST(req: Request, ctx: RouteContext<"/api/public/forms/[slug]/submit">) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  const ip = ipKey(clientIp(req.headers));
  const rl = rateLimit(`submit:${ip}:${slug}`, 10, 60_000);
  if (!rl.ok) return problem(429, "Zu viele Einreichungen. Bitte warten Sie einen Moment.", { retryAfter: rl.retryAfter });
  // Unterschriften sind die größten Werte (≤ 400 KB), plus Antworten
  const body = await readJson<SubmitInput>(req, 1_500_000);
  if (!body || typeof body !== "object" || typeof body.answers !== "object") return problem(400, "Ungültige Anfrage.");
  let r: Awaited<ReturnType<typeof submit>>;
  try {
    r = await submit(slug, body, { userAgent: req.headers.get("user-agent"), ipHash: ip });
  } catch (e) {
    // Nie ungefiltert loggen lassen – Datenbankfehler enthielten sonst Antwortinhalte
    logError("submit", e);
    return problem(500, "Das Absenden hat nicht geklappt. Bitte versuchen Sie es in einem Moment erneut – Ihre Angaben bleiben erhalten.");
  }
  if (!r.ok) return problem(r.status, r.error, { ...(r.errors ? { fields: r.errors } : {}), ...(r.retryAfterMs ? { retryAfterMs: r.retryAfterMs } : {}), ...(r.code ? { code: r.code } : {}) });
  return json({ ok: true, number: r.number, endingId: r.endingId });
}
