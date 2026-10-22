/**
 * Öffentliche Einreichung: alles, was von außen kommt, ist nicht vertrauenswürdig.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { setFormStatus, updatePublishSettings } from "@/server/forms/service";
import { signPayload, shortId } from "@/server/lib/crypto";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

let W: Awaited<ReturnType<typeof makeWorkspace>>;
let form: Awaited<ReturnType<typeof publishedForm>>;

beforeAll(async () => {
  W = await makeWorkspace("Kanzlei Einreichung");
  form = await publishedForm(W.workspace.id, W.user.id);
});

const valid = { name: "Max Mustermann", email: "max@example.de" };
const count = () => db.$count(schema.submissions, eq(schema.submissions.formId, form.id));

describe("Einreichung", () => {
  it("speichert eine gültige Antwort dauerhaft und normalisiert", async () => {
    const before = await count();
    const r = await submit(form.slug, { answers: { ...valid, email: "MAX@Example.DE" }, ...tokenFor(form.id), clientKey: key() }, ctx);
    expect(r.ok).toBe(true);
    expect(await count()).toBe(before + 1);
    if (r.ok) {
      const row = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, r.submissionId) });
      expect(row?.data).toEqual({ name: "Max Mustermann", email: "max@example.de" });
      expect(row?.respondentEmail).toBe("max@example.de");
    }
  });

  it("lehnt ungültige und fehlende Pflichtangaben ab", async () => {
    const r = await submit(form.slug, { answers: { name: "", email: "kein-mail" }, ...tokenFor(form.id), clientKey: key() }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(Object.keys(r.errors ?? {}).sort()).toEqual(["email", "name"]);
    }
  });

  it("verwirft Antworten für verborgene und unbekannte Felder", async () => {
    const r = await submit(form.slug, { answers: { ...valid, kind: "Privat", company: "<script>alert(1)</script>", isAdmin: true, __proto__x: 1 }, ...tokenFor(form.id), clientKey: key() }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const row = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, r.submissionId) });
      expect(row?.data).toEqual({ ...valid, kind: "Privat" });
    }
  });

  it("lehnt manipulierte, fremde und abgelaufene Tokens ab", async () => {
    const t = tokenFor(form.id);
    const tampered = t.token.slice(0, -2) + (t.token.endsWith("A") ? "BB" : "AA");
    expect(await submit(form.slug, { answers: valid, token: tampered, clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 403 });
    const other = signPayload({ f: "00000000-0000-0000-0000-000000000000", t: Date.now() - 10_000, u: "x" }, "form", 3600);
    expect(await submit(form.slug, { answers: valid, token: other, clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 403 });
    const expired = signPayload({ f: form.id, t: Date.now() - 10_000, u: "x" }, "form", -1);
    expect(await submit(form.slug, { answers: valid, token: expired, clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 403 });
    const wrongPurpose = signPayload({ f: form.id, t: Date.now() - 10_000, u: "x" }, "unlock", 3600);
    expect(await submit(form.slug, { answers: valid, token: wrongPurpose, clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 403 });
  });

  it("verwirft Honeypot-Einreichungen still und weist zu schnelles Absenden mit Hinweis ab", async () => {
    const before = await count();
    const honey = await submit(form.slug, { answers: valid, ...tokenFor(form.id), honeypot: "https://spam.example", clientKey: key() }, ctx);
    expect(honey.ok).toBe(true);
    const k = key();
    const fast = await submit(form.slug, { answers: valid, ...tokenFor(form.id, shortId(24), 300), clientKey: k }, ctx);
    expect(fast).toMatchObject({ ok: false, status: 429 });
    expect(await count()).toBe(before);
    // Derselbe Mensch sendet kurz darauf erneut (gleicher Schlüssel) – jetzt wird gespeichert
    const again = await submit(form.slug, { answers: valid, ...tokenFor(form.id), clientKey: k }, ctx);
    expect(again.ok).toBe(true);
    expect(await count()).toBe(before + 1);
  });

  it("ist idempotent: doppeltes Absenden erzeugt eine Antwort", async () => {
    const before = await count();
    const k = key();
    const t = tokenFor(form.id);
    const a = await submit(form.slug, { answers: valid, ...t, clientKey: k }, ctx);
    const b = await submit(form.slug, { answers: valid, ...t, clientKey: k }, ctx);
    expect(a.ok && b.ok && a.submissionId === b.submissionId).toBe(true);
    expect(await count()).toBe(before + 1);
  });

  it("lehnt ungültige Idempotenzschlüssel ab", async () => {
    expect(await submit(form.slug, { answers: valid, ...tokenFor(form.id), clientKey: "x" }, ctx)).toMatchObject({ ok: false, status: 400 });
  });

  it("akzeptiert keine fremden oder nicht hochgeladenen Datei-IDs", async () => {
    const other = await publishedForm(W.workspace.id, W.user.id);
    const otherSession = shortId(24);
    await db.insert(schema.files).values({ id: shortId(24), workspaceId: W.workspace.id, formId: other.id, fieldId: "doc", uploadSession: otherSession, kind: "upload", name: "x.pdf", mime: "application/pdf", size: 10, sha256: "0", storageKey: "ws/x", status: "clean" });
    const foreign = await db.query.files.findFirst({ where: eq(schema.files.uploadSession, otherSession) });
    const ref = { id: foreign!.id, name: "x.pdf", size: 10, type: "application/pdf" };
    const r1 = await submit(form.slug, { answers: { ...valid, doc: [ref] }, ...tokenFor(form.id), clientKey: key() }, ctx);
    expect(r1).toMatchObject({ ok: false, status: 422 });
    // gleiche Datei, aber fremde Upload-Sitzung im eigenen Formular
    await db.update(schema.files).set({ formId: form.id }).where(eq(schema.files.id, foreign!.id));
    const r2 = await submit(form.slug, { answers: { ...valid, doc: [ref] }, ...tokenFor(form.id), clientKey: key() }, ctx);
    expect(r2).toMatchObject({ ok: false, status: 422 });
    // eigene Sitzung: wird angenommen, Metadaten kommen vom Server
    const r3 = await submit(form.slug, { answers: { ...valid, doc: [{ ...ref, name: "../../evil.exe", size: 999999 }] }, ...tokenFor(form.id, otherSession), clientKey: key() }, ctx);
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      const row = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, r3.submissionId) });
      expect((row?.data.doc as { name: string; size: number }[])[0]).toMatchObject({ name: "x.pdf", size: 10 });
    }
  });

  it("respektiert Pausieren und Einreichungslimit", async () => {
    const f = await publishedForm(W.workspace.id, W.user.id);
    await updatePublishSettings(W.workspace.id, W.user.id, f.id, { maxSubmissions: 1 });
    expect((await submit(f.slug, { answers: valid, ...tokenFor(f.id), clientKey: key() }, ctx)).ok).toBe(true);
    expect(await submit(f.slug, { answers: valid, ...tokenFor(f.id), clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 410 });
    const g = await publishedForm(W.workspace.id, W.user.id);
    await setFormStatus(W.workspace.id, W.user.id, g.id, "paused");
    expect(await submit(g.slug, { answers: valid, ...tokenFor(g.id), clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 410 });
  });

  it("veröffentlichte Version bleibt stabil, während der Entwurf geändert wird", async () => {
    const f = await publishedForm(W.workspace.id, W.user.id);
    const { saveDraft } = await import("@/server/forms/service");
    const draft = structuredClone(f.draft);
    draft.pages[0].fields = draft.pages[0].fields.filter((x) => x.id !== "email");
    await saveDraft(W.workspace.id, f.id, draft, f.draftRevision);
    // Öffentlich gilt weiter die alte Version mit Pflicht-E-Mail
    const r = await submit(f.slug, { answers: { name: "Ohne Mail" }, ...tokenFor(f.id), clientKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, status: 422 });
  });

  it("unbekannte oder ungültige Slugs", async () => {
    expect(await submit("gibt-es-nicht", { answers: valid, ...tokenFor(form.id), clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 410 });
    expect(await submit("../../etc", { answers: valid, ...tokenFor(form.id), clientKey: key() }, ctx)).toMatchObject({ ok: false, status: 410 });
  });
});
