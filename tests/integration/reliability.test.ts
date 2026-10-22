/**
 * Regressionen aus der unabhängigen Zuverlässigkeitsprüfung (H3, H4, L1, L6, M4).
 */
import { describe, expect, it, vi } from "vitest";

// Nicht erreichbarer Mailserver (für H3). vi.hoisted läuft vor allen Importen –
// die Konfiguration wird beim Laden des DB-Moduls einmalig gelesen.
vi.hoisted(() => {
  process.env.SMTP_URL = "smtp://127.0.0.1:1";
});
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { shortId } from "@/server/lib/crypto";
import { createForm, deleteForm, listTrash, publishForm, purgeForm, restoreForm, saveDraft } from "@/server/forms/service";
import { retentionSweep } from "@/server/queue/retention";
import { runJob } from "@/server/queue/runner";
import { handlers } from "@/server/queue/handlers";
import { getObject, putObject, storageKey } from "@/server/storage/s3";
import { issueFormToken, submit } from "@/server/submissions/submit";
import { contactDefinition, ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

const valid = { name: "Erika Muster", email: "erika@example.de" };
const count = (formId: string) => db.$count(schema.submissions, eq(schema.submissions.formId, formId));

describe("Zuverlässigkeit", () => {
  it("M4: 20 parallele Duplikate mit demselben Schlüssel ergeben genau eine Antwort und nur Erfolge", async () => {
    const { workspace, user } = await makeWorkspace("Parallel");
    const form = await publishedForm(workspace.id, user.id);
    const t = tokenFor(form.id);
    const k = key();
    const results = await Promise.all(Array.from({ length: 20 }, () => submit(form.slug, { answers: valid, ...t, clientKey: k }, ctx)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => (r.ok ? r.submissionId : ""))).size).toBe(1);
    expect(await count(form.id)).toBe(1);
  });

  it("L6: Token einer inzwischen ersetzten Version → 409 statt stiller Prüfung gegen die neue", async () => {
    const { workspace, user } = await makeWorkspace("Version");
    const form = await publishedForm(workspace.id, user.id);
    const v1 = form.publishedVersionId!;
    const token = issueFormToken(form.id, shortId(24), Date.now() - 10_000, v1);
    const f = (await db.query.forms.findFirst({ where: eq(schema.forms.id, form.id) }))!;
    await saveDraft(workspace.id, form.id, { ...f.draft, title: "Neu" }, f.draftRevision);
    await publishForm(workspace.id, user.id, form.id);
    const r = await submit(form.slug, { answers: valid, token, clientKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, status: 409, code: "form_updated" });
    // Mit Token der aktuellen Version klappt es
    const now = (await db.query.forms.findFirst({ where: eq(schema.forms.id, form.id) }))!;
    const ok = await submit(form.slug, { answers: valid, token: issueFormToken(form.id, shortId(24), Date.now() - 10_000, now.publishedVersionId!), clientKey: key() }, ctx);
    expect(ok.ok).toBe(true);
  });

  it("H4: Papierkorb – wiederherstellen mit alter Adresse, endgültig erst nach 30 Tagen inklusive Antworten", async () => {
    const { workspace, user } = await makeWorkspace("Papierkorb");
    const form = await publishedForm(workspace.id, user.id);
    await submit(form.slug, { answers: valid, ...tokenFor(form.id), clientKey: key() }, ctx);
    await deleteForm(workspace.id, user.id, form.id);
    expect((await listTrash(workspace.id)).map((t) => t.id)).toEqual([form.id]);
    const slug = await restoreForm(workspace.id, user.id, form.id);
    expect(slug).toBe(form.slug);
    expect(await count(form.id)).toBe(1);
    // Nach 29 Tagen im Papierkorb noch da, nach 31 Tagen endgültig weg
    await deleteForm(workspace.id, user.id, form.id);
    await db.update(schema.forms).set({ deletedAt: new Date(Date.now() - 29 * 86_400_000) }).where(eq(schema.forms.id, form.id));
    await retentionSweep();
    expect(await count(form.id)).toBe(1);
    await db.update(schema.forms).set({ deletedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(schema.forms.id, form.id));
    await retentionSweep();
    expect(await db.query.forms.findFirst({ where: eq(schema.forms.id, form.id) })).toBeUndefined();
    expect(await count(form.id)).toBe(0);
  });

  it("H4: Endgültig löschen geht nur für Formulare im Papierkorb des eigenen Workspace", async () => {
    const a = await makeWorkspace("A");
    const b = await makeWorkspace("B");
    const form = await createForm(a.workspace.id, a.user.id, contactDefinition());
    await expect(purgeForm(a.workspace.id, a.user.id, form.id)).rejects.toThrow(); // nicht im Papierkorb
    await deleteForm(a.workspace.id, a.user.id, form.id);
    await expect(purgeForm(b.workspace.id, b.user.id, form.id)).rejects.toThrow(); // fremder Workspace
    await purgeForm(a.workspace.id, a.user.id, form.id);
    expect(await db.query.forms.findFirst({ where: eq(schema.forms.id, form.id) })).toBeUndefined();
  });

  it("H3: Freigabe-Schritt legt bei Wiederholungsversuchen keine zweite Freigabe an", async () => {
    const { workspace, user } = await makeWorkspace("Freigabe");
    const form = await publishedForm(workspace.id, user.id);
    const r = await submit(form.slug, { answers: valid, ...tokenFor(form.id), clientKey: key() }, ctx);
    if (!r.ok) throw new Error("submit");
    await db.delete(schema.jobs);
    await db.insert(schema.workflows).values({
      workspaceId: workspace.id,
      formId: form.id,
      name: "Prüfen",
      trigger: "submission.created",
      steps: [{ id: "s1", type: "approval", title: "Prüfen", assigneeRole: "owner" }],
    });
    const [job] = await db.insert(schema.jobs).values({ type: "workflow.run", payload: { trigger: "submission.created", submissionId: r.submissionId }, status: "running", attempts: 1, maxAttempts: 12 }).returning();
    const first = await runJob(job, handlers["workflow.run"]);
    expect(first).toBe("retry"); // Mailserver nicht erreichbar
    const again = (await db.query.jobs.findFirst({ where: eq(schema.jobs.id, job.id) }))!;
    await runJob({ ...again, attempts: 2 }, handlers["workflow.run"]);
    const approvals = await db.query.approvals.findMany({ where: eq(schema.approvals.submissionId, r.submissionId) });
    expect(approvals).toHaveLength(1);
  });

  it("L1: Speicherobjekte ohne Dateizeile werden nach 24 h entfernt, zugeordnete bleiben", async () => {
    const { workspace } = await makeWorkspace("Waisen");
    const orphanKey = storageKey(workspace.id, shortId(24));
    await putObject(orphanKey, Buffer.from("x"), "image/png");
    const keptId = shortId(24);
    const keptKey = storageKey(workspace.id, keptId);
    await putObject(keptKey, Buffer.from("y"), "image/png");
    await db.insert(schema.files).values({ id: keptId, workspaceId: workspace.id, kind: "asset", name: "a.png", mime: "image/png", size: 1, sha256: "x", storageKey: keptKey, status: "clean" });
    // „Jetzt“ zwei Tage in die Zukunft verlegen: beide Objekte sind dann älter als 24 h
    await retentionSweep(new Date(Date.now() + 2 * 86_400_000));
    await expect(getObject(orphanKey)).rejects.toThrow();
    expect((await getObject(keptKey)).toString()).toBe("y");
  });
});
