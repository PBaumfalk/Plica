import QRCode from "qrcode";
import { AuthError, assertViewer } from "@/server/auth/session";
import { config } from "@/server/config";
import { getForm, NotFound } from "@/server/forms/service";
import { problem } from "@/server/lib/http";

/** QR-Code zur öffentlichen Adresse: schwarz auf weiß, Ruhezone, Fehlerkorrektur M – druckfest. */
export async function GET(req: Request, ctx: RouteContext<"/api/forms/[id]/qr">) {
  const { id } = await ctx.params;
  try {
    const v = await assertViewer("forms.read");
    const form = await getForm(v.workspace.id, id);
    const url = `${config().publicUrl}/f/${form.slug}`;
    const q = new URL(req.url).searchParams;
    const format = q.get("format") === "png" ? "png" : "svg";
    const download = q.get("download") === "1";
    const name = `qr-${form.slug}.${format}`;
    const headers: Record<string, string> = {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(download ? { "content-disposition": `attachment; filename="${name}"` } : {}),
    };
    const opts = { errorCorrectionLevel: "M" as const, margin: 4, color: { dark: "#000000", light: "#ffffff" } };
    if (format === "png") {
      const buf = await QRCode.toBuffer(url, { ...opts, type: "png", width: 1200 });
      return new Response(new Uint8Array(buf), { headers: { ...headers, "content-type": "image/png" } });
    }
    const svg = await QRCode.toString(url, { ...opts, type: "svg" });
    return new Response(svg, { headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  } catch (e) {
    if (e instanceof AuthError) return problem(e.status, e.message);
    if (e instanceof NotFound) return problem(404, e.message);
    throw e;
  }
}
