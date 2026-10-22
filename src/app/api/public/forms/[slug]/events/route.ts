import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { readJson } from "@/server/lib/http";
import { rateLimit } from "@/server/lib/ratelimit";
import { clientIp, ipKey, sameOrigin } from "@/server/lib/request";

const TYPES = new Set(["view", "start", "page", "submit"]);

/** Anonyme Ereignisse für die Abbruchanalyse. Keine IP, keine Cookies – nur eine zufällige Besuchs-ID pro Seitenaufruf. */
export async function POST(req: Request, ctx: RouteContext<"/api/public/forms/[slug]/events">) {
  const { slug } = await ctx.params;
  // Fremde Websites dürfen die Abbruchanalyse nicht verfälschen
  if (!sameOrigin(req)) return new Response(null, { status: 204 });
  if (!rateLimit(`ev:${ipKey(clientIp(req.headers))}`, 120, 60_000).ok) return new Response(null, { status: 204 });
  const body = await readJson<{ visit?: string; type?: string; pageId?: string }>(req, 2_000);
  if (!body || typeof body.visit !== "string" || !/^[A-Za-z0-9_-]{8,40}$/.test(body.visit) || !TYPES.has(String(body.type))) return new Response(null, { status: 204 });
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.slug, slug), isNull(schema.forms.deletedAt)), columns: { id: true, publishedVersionId: true, status: true } });
  if (!form || form.status !== "published") return new Response(null, { status: 204 });
  await db.insert(schema.formEvents).values({
    formId: form.id,
    versionId: form.publishedVersionId,
    visit: body.visit,
    type: body.type as "view",
    pageId: typeof body.pageId === "string" ? body.pageId.slice(0, 64) : null,
  });
  return new Response(null, { status: 204 });
}
