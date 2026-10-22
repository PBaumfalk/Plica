import { config } from "@/server/config";
import { handlePublicUpload } from "@/server/files/upload";
import { logError } from "@/server/lib/log";
import { json, problem, tooLarge } from "@/server/lib/http";
import { rateLimit } from "@/server/lib/ratelimit";
import { clientIp, ipKey, sameOrigin } from "@/server/lib/request";

export async function POST(req: Request, ctx: RouteContext<"/api/public/forms/[slug]/upload">) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  if (tooLarge(req, config().UPLOAD_MAX_MB * 1024 * 1024 + 64 * 1024)) return problem(413, `Die Datei ist größer als ${config().UPLOAD_MAX_MB} MB.`);
  const rl = rateLimit(`upload:${ipKey(clientIp(req.headers))}`, 30, 60_000);
  if (!rl.ok) return problem(429, "Zu viele Uploads. Bitte warten Sie einen Moment.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return problem(400, "Ungültige Anfrage.");
  }
  let r: Awaited<ReturnType<typeof handlePublicUpload>>;
  try {
    r = await handlePublicUpload(slug, form);
  } catch (e) {
    logError("upload", e);
    return problem(500, "Hochladen fehlgeschlagen. Bitte versuchen Sie es erneut.");
  }
  if (!r.ok) return problem(r.status, r.error);
  return json(r.file, 200, { "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; frame-ancestors 'none'; sandbox" });
}
