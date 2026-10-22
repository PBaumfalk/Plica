/**
 * Uploads: Typ nach Inhalt, nicht nach Endung; Name bereinigt; Grenzen.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { cleanName, handlePublicUpload } from "@/server/files/upload";
import { getObject } from "@/server/storage/s3";
import { makeWorkspace, publishedForm, tokenFor } from "./helpers";

let form: Awaited<ReturnType<typeof publishedForm>>;
beforeAll(async () => {
  const W = await makeWorkspace("Kanzlei Upload");
  form = await publishedForm(W.workspace.id, W.user.id);
});

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
const EXE = Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"), Buffer.alloc(200)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = Buffer.from("<!doctype html><html><script>alert(1)</script></html>");

function fd(buf: Buffer, name: string, type: string, opts: { token?: string; fieldId?: string } = {}) {
  const f = new FormData();
  f.set("token", opts.token ?? tokenFor(form.id).token);
  f.set("fieldId", opts.fieldId ?? "doc");
  f.set("file", new File([new Uint8Array(buf)], name, { type }));
  return f;
}

describe("Uploads", () => {
  it("nimmt echte PDF und PNG an und speichert sie im Objektspeicher", async () => {
    const r = await handlePublicUpload(form.slug, fd(PDF, "vollmacht.pdf", "application/pdf"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.type).toBe("application/pdf");
      const row = await db.query.files.findFirst({ where: eq(schema.files.id, r.file.id) });
      expect(row?.status).toBe("unscanned"); // ohne Virenscanner: Quarantäne
      expect((await getObject(row!.storageKey)).equals(PDF)).toBe(true);
      expect(row!.storageKey).toMatch(/^ws\/[0-9a-f-]{36}\/[A-Za-z0-9]{24}$/);
    }
    expect((await handlePublicUpload(form.slug, fd(PNG, "foto.png", "image/png"))).ok).toBe(true);
  });

  it("erkennt getarnte Dateien am Inhalt", async () => {
    expect(await handlePublicUpload(form.slug, fd(EXE, "rechnung.pdf", "application/pdf"))).toMatchObject({ ok: false, status: 415 });
    expect(await handlePublicUpload(form.slug, fd(SVG, "logo.png", "image/png"))).toMatchObject({ ok: false, status: 415 });
    expect(await handlePublicUpload(form.slug, fd(HTML, "brief.pdf", "application/pdf"))).toMatchObject({ ok: false, status: 415 });
    expect(await handlePublicUpload(form.slug, fd(HTML, "brief.txt", "text/plain"))).toMatchObject({ ok: false, status: 415 }); // Feld erlaubt nur PDF/PNG
  });

  it("prüft Feld, Token und Leerdateien", async () => {
    expect(await handlePublicUpload(form.slug, fd(PDF, "a.pdf", "application/pdf", { fieldId: "name" }))).toMatchObject({ ok: false, status: 400 });
    expect(await handlePublicUpload(form.slug, fd(PDF, "a.pdf", "application/pdf", { token: "manipuliert.x" }))).toMatchObject({ ok: false, status: 403 });
    expect(await handlePublicUpload(form.slug, fd(Buffer.alloc(0), "a.pdf", "application/pdf"))).toMatchObject({ ok: false, status: 413 });
  });

  it("setzt die Größengrenze durch", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(6 * 1024 * 1024)]);
    expect(await handlePublicUpload(form.slug, fd(big, "gross.pdf", "application/pdf"))).toMatchObject({ ok: false, status: 413 });
  });

  it("bereinigt Dateinamen (kein Path Traversal)", () => {
    expect(cleanName("../../etc/passwd")).toBe("passwd");
    expect(cleanName("..\\..\\boot.ini")).toBe("boot.ini");
    expect(cleanName("..")).toBe("datei");
    expect(cleanName("a\u0000b<c>.pdf")).toBe("abc.pdf");
  });
});
