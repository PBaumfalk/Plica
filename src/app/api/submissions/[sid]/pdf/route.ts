import { audit } from "@/server/audit";
import { AuthError, assertViewer } from "@/server/auth/session";
import { NotFound } from "@/server/forms/service";
import { contentDisposition } from "@/server/lib/download";
import { problem } from "@/server/lib/http";
import { renderSubmissionPdf } from "@/server/pdf";

export async function GET(req: Request, ctx: RouteContext<"/api/submissions/[sid]/pdf">) {
  const { sid } = await ctx.params;
  try {
    const v = await assertViewer("submissions.read");
    const url = new URL(req.url);
    const inline = url.searchParams.get("inline") === "1";
    const templateId = url.searchParams.get("template") ?? undefined;
    const { buffer, filename } = await renderSubmissionPdf(v.workspace.id, sid, { templateId });
    if (!inline) await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "submission.pdf_downloaded", targetType: "submission", targetId: sid });
    return new Response(new Uint8Array(buffer), {
      headers: { "content-type": "application/pdf", "content-disposition": contentDisposition(filename, inline), "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    if (e instanceof NotFound) return problem(404, e.message);
    throw e;
  }
}
