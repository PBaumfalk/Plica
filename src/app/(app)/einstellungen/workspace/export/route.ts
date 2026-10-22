import { assertViewer, AuthError } from "@/server/auth/session";
import { exportWorkspace } from "@/server/workspaces/workspace";

export async function GET() {
  try {
    const v = await assertViewer("workspace.manage");
    const data = await exportWorkspace({ userId: v.user.id, workspaceId: v.workspace.id, role: v.role });
    const safe = v.workspace.name.replace(/[^A-Za-z0-9äöüÄÖÜß_-]+/g, "-").replace(/^-|-$/g, "") || "workspace";
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="plica-export-${date}.json"; filename*=UTF-8''${encodeURIComponent(`plica-export-${safe}-${date}.json`)}`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return new Response(e.message, { status: e.status, headers: { "content-type": "text/plain; charset=utf-8" } });
    throw e;
  }
}
