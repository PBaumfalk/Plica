/** Regression: Zähler in der Formularliste (korrelierte Unterabfragen). */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { listForms } from "@/server/forms/service";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

describe("listForms", () => {
  it("zählt Antworten, neue Antworten und letzten Eingang je Formular korrekt", async () => {
    const { workspace, user } = await makeWorkspace("Liste");
    const a = await publishedForm(workspace.id, user.id);
    const b = await publishedForm(workspace.id, user.id);
    for (let i = 0; i < 3; i++) await submit(a.slug, { answers: { name: "A", email: "a@example.de" }, ...tokenFor(a.id), clientKey: key() }, ctx);
    const one = await submit(a.slug, { answers: { name: "A", email: "a@example.de" }, ...tokenFor(a.id), clientKey: key() }, ctx);
    if (!one.ok) throw new Error("submit");
    await db.update(schema.submissions).set({ status: "done" }).where(eq(schema.submissions.id, one.submissionId));
    const rows = await listForms(workspace.id);
    const ra = rows.find((r) => r.id === a.id)!;
    const rb = rows.find((r) => r.id === b.id)!;
    expect(ra.liveCount).toBe(4);
    expect(ra.newCount).toBe(3);
    expect(ra.lastSubmissionAt).not.toBeNull();
    expect(rb.liveCount).toBe(0);
    expect(rb.lastSubmissionAt).toBeNull();
  });
});

describe("Adresse beim ersten Veröffentlichen", () => {
  it("ersetzt die Platzhalter-Adresse durch eine aus dem Titel – aber nur beim ersten Mal", async () => {
    const { createForm, publishForm, saveDraft } = await import("@/server/forms/service");
    const { contactDefinition } = await import("./helpers");
    const { workspace, user } = await makeWorkspace("Adresse");
    const def = { ...contactDefinition(), title: "Unbenanntes Formular" };
    const f = await createForm(workspace.id, user.id, def);
    expect(f.slug).toMatch(/^unbenanntes-formular/);
    await saveDraft(workspace.id, f.id, { ...def, title: "Rückruf-Bitte Kanzlei" }, f.draftRevision);
    await publishForm(workspace.id, user.id, f.id);
    const after = await db.query.forms.findFirst({ where: eq(schema.forms.id, f.id) });
    expect(after!.slug).toBe("rueckruf-bitte-kanzlei");
    // Zweites Veröffentlichen mit neuem Titel ändert die geteilte Adresse nicht
    await saveDraft(workspace.id, f.id, { ...def, title: "Ganz anders" }, after!.draftRevision);
    await publishForm(workspace.id, user.id, f.id);
    expect((await db.query.forms.findFirst({ where: eq(schema.forms.id, f.id) }))!.slug).toBe("rueckruf-bitte-kanzlei");
  });
});
