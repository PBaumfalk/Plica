/**
 * Entwurf speichern per keepalive-Request beim Schließen des Editors.
 * Gleiche Regeln wie die Server Action: Anmeldung, Berechtigung,
 * Workspace-Bindung, Revisionsschutz – plus Herkunftsprüfung (CSRF).
 */
import { ZodError } from "zod";
import { AuthError, assertViewer } from "@/server/auth/session";
import { Conflict, NotFound, saveDraft } from "@/server/forms/service";
import { json, problem, readJson } from "@/server/lib/http";
import { sameOrigin } from "@/server/lib/request";

export async function POST(req: Request, ctx: RouteContext<"/api/forms/[id]/draft">) {
  if (!sameOrigin(req)) return problem(403, "Ungültige Herkunft der Anfrage.");
  const { id } = await ctx.params;
  try {
    const v = await assertViewer("forms.write");
    const body = await readJson<{ definition?: unknown; revision?: unknown }>(req, 2_000_000);
    if (!body || typeof body.revision !== "number") return problem(400, "Ungültige Anfrage.");
    const revision = await saveDraft(v.workspace.id, id, body.definition, body.revision);
    return json({ revision });
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    if (e instanceof NotFound) return problem(404, e.message);
    if (e instanceof Conflict) return problem(409, e.message);
    if (e instanceof ZodError) return problem(400, "Der Entwurf ist ungültig.");
    throw e;
  }
}
