/**
 * REST-API, Dateien: Quarantäne-Dateien erst nach bewusster Freigabe, wie in der Oberfläche.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/files/[id]/route";
import { TOKEN_PREFIX } from "@/server/api/tokens";
import { db, schema } from "@/server/db";
import { randomToken, sha256, shortId } from "@/server/lib/crypto";
import { putObject, storageKey } from "@/server/storage/s3";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

describe("API: Dateien in Quarantäne", () => {
  it("423 bis zur Freigabe, danach Auslieferung mit Kennzeichnung", async () => {
    const { workspace, user } = await makeWorkspace("API-Dateien");
    const form = await publishedForm(workspace.id, user.id);
    const r = await submit(form.slug, { answers: { name: "Erika Muster", email: "erika@example.de" }, ...tokenFor(form.id), clientKey: key() }, ctx);
    if (!r.ok) throw new Error("submit");
    const id = shortId(24);
    const sk = storageKey(workspace.id, id);
    await putObject(sk, Buffer.from("%PDF-1.4 test"), "application/pdf");
    await db.insert(schema.files).values({ id, workspaceId: workspace.id, submissionId: r.submissionId, kind: "upload", name: "vollmacht.pdf", mime: "application/pdf", size: 13, sha256: "x", storageKey: sk, status: "unscanned" });
    const token = `${TOKEN_PREFIX}${randomToken(24)}`;
    await db.insert(schema.apiTokens).values({ workspaceId: workspace.id, userId: user.id, name: "Test", tokenHash: sha256(token), prefix: token.slice(0, 8), scope: "read" });
    const call = () => GET(new Request(`http://localhost/api/v1/files/${id}`, { headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({ id }) } as never);

    expect((await call()).status).toBe(423);
    await db.update(schema.files).set({ meta: { releasedAt: new Date().toISOString(), releasedBy: user.id } }).where(eq(schema.files.id, id));
    const ok = await call();
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-plica-scan")).toBe("unscanned");
    expect(Buffer.from(await ok.arrayBuffer()).toString()).toBe("%PDF-1.4 test");
  });
});
