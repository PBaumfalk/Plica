import { config } from "@/server/config";
import { handlePublicUpload } from "@/server/files/upload";
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
  const r = await handlePublicUpload(slug, form);
  if (!r.ok) return problem(r.status, r.error);
  return json(r.file);
}
