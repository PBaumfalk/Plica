import { apiHandler, require } from "@/server/api/auth";
import { loadSubmission } from "@/server/api/submission";
import { audit } from "@/server/audit";
import { renderSubmissionPdf } from "@/server/pdf";

export const GET = apiHandler(async (_req, p, ctx: RouteContext<"/api/v1/submissions/[id]/pdf">) => {
  require(p, "submissions.read");
  const { sub } = await loadSubmission(p.workspaceId, (await ctx.params).id);
  const { buffer, filename } = await renderSubmissionPdf(p.workspaceId, sub.id);
  await audit({ workspaceId: p.workspaceId, userId: p.userId, action: "api.pdf_generated", targetType: "submission", targetId: sub.id, meta: { tokenId: p.tokenId } });
  return new Response(new Uint8Array(buffer), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
});
