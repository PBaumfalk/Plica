import { AuthError, assertViewer } from "@/server/auth/session";
import { logError } from "@/server/lib/log";
import { NotFound } from "@/server/forms/service";
import { problem, readJson } from "@/server/lib/http";
import { sameOrigin } from "@/server/lib/request";
import { renderTemplatePreview } from "@/server/pdf";
import { assertForm } from "@/server/submissions/service";

/** Vorschau einer noch nicht gespeicherten PDF-Vorlage. */
export async function POST(req: Request, ctx: RouteContext<"/api/forms/[id]/pdf-preview">) {
  const { id } = await ctx.params;
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  try {
    const v = await assertViewer("submissions.read");
    await assertForm(v.workspace.id, id);
    const body = await readJson<{ body?: string }>(req, 100_000);
    if (!body || typeof body.body !== "string") return problem(400, "Ungültige Anfrage.");
    const pdf = await renderTemplatePreview(v.workspace.id, id, body.body);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    if (e instanceof NotFound) return problem(404, e.message);
    logError("pdf-preview", e);
    return problem(500, "Die Vorschau konnte nicht erzeugt werden. Details stehen im Server-Log.");
  }
}
