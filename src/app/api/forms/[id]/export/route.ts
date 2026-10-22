import { audit } from "@/server/audit";
import { AuthError, assertViewer } from "@/server/auth/session";
import { exportSubmissions, type ExportFormat } from "@/server/export/export";
import { NotFound } from "@/server/forms/service";
import { contentDisposition } from "@/server/lib/download";
import { problem } from "@/server/lib/http";
import { assertForm, parseListQuery } from "@/server/submissions/service";

const FORMATS = new Set(["csv", "xlsx", "json"]);

export async function GET(req: Request, ctx: RouteContext<"/api/forms/[id]/export">) {
  const { id } = await ctx.params;
  try {
    const v = await assertViewer("submissions.export");
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";
    if (!FORMATS.has(format)) return problem(400, "Unbekanntes Exportformat.");
    const form = await assertForm(v.workspace.id, id);
    const q = parseListQuery(Object.fromEntries(url.searchParams));
    const ids = url.searchParams.get("ids");
    if (ids) q.ids = ids.split(",").slice(0, 1000);
    q.sort = q.sort ?? "number_asc";
    const out = await exportSubmissions(v.workspace.id, form.id, form.draft.title, { ...q, page: undefined }, format as ExportFormat);
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "submissions.exported", targetType: "form", targetId: form.id, meta: { format, selection: ids ? ids.split(",").length : null, filters: Object.fromEntries([...url.searchParams].filter(([k]) => k !== "ids" && k !== "format")) } });
    return new Response(out.body as BodyInit, {
      headers: {
        "content-type": out.contentType,
        "content-disposition": contentDisposition(out.filename),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    if (e instanceof NotFound) return problem(404, e.message);
    throw e;
  }
}
