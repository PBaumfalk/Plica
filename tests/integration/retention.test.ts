/**
 * Aufbewahrung: Die tägliche Bereinigung löscht endgültig, was abgelaufen
 * ist – und nur das. Insbesondere bleiben Uploads gültiger
 * Fortsetzungslinks erhalten.
 */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { encrypt, shortId } from "@/server/lib/crypto";
import { retentionSweep } from "@/server/queue/retention";
import { getObject, putObject, storageKey } from "@/server/storage/s3";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

const DAY = 86_400_000;

async function upload(workspaceId: string, formId: string, opts: { session?: string | null; submissionId?: string; ageMs?: number }) {
  const id = shortId(24);
  const k = storageKey(workspaceId, id);
  await putObject(k, Buffer.from("%PDF-1.4 test"), "application/pdf");
  await db.insert(schema.files).values({
    id,
    workspaceId,
    formId,
    submissionId: opts.submissionId,
    uploadSession: opts.session ?? null,
    kind: "upload",
    name: "test.pdf",
    mime: "application/pdf",
    size: 13,
    sha256: "x",
    storageKey: k,
    status: "clean",
    createdAt: new Date(Date.now() - (opts.ageMs ?? 0)),
  });
  return { id, key: k };
}

const exists = async (id: string) => !!(await db.query.files.findFirst({ where: eq(schema.files.id, id) }));
const objectExists = (k: string) => getObject(k).then(() => true, () => false);

describe("Aufbewahrung", () => {
  it("löscht abgelaufene Antworten samt Dateien, verwaiste Uploads und abgelaufene Entwürfe – schont aber gültige Fortsetzungen", async () => {
    const { workspace, user } = await makeWorkspace("Aufbewahrung");
    const form = await publishedForm(workspace.id, user.id);

    // Eine abgelaufene und eine noch gültige Antwort
    const expired = await submit(form.slug, { answers: { name: "Alt", email: "alt@example.de" }, ...tokenFor(form.id), clientKey: key() }, ctx);
    const kept = await submit(form.slug, { answers: { name: "Neu", email: "neu@example.de" }, ...tokenFor(form.id), clientKey: key() }, ctx);
    if (!expired.ok || !kept.ok) throw new Error("submit failed");
    await db.update(schema.submissions).set({ deleteAfter: new Date(Date.now() - DAY) }).where(eq(schema.submissions.id, expired.submissionId));
    await db.update(schema.submissions).set({ deleteAfter: new Date(Date.now() + DAY) }).where(eq(schema.submissions.id, kept.submissionId));
    const expiredFile = await upload(workspace.id, form.id, { submissionId: expired.submissionId });
    const keptFile = await upload(workspace.id, form.id, { submissionId: kept.submissionId });

    // Verwaiste Uploads
    const oldOrphan = await upload(workspace.id, form.id, { session: shortId(24), ageMs: 2 * DAY });
    const freshOrphan = await upload(workspace.id, form.id, { session: shortId(24), ageMs: 60_000 });
    const resumeSession = shortId(24);
    const resumeUpload = await upload(workspace.id, form.id, { session: resumeSession, ageMs: 3 * DAY });
    const deadSession = shortId(24);
    const deadDraftUpload = await upload(workspace.id, form.id, { session: deadSession, ageMs: 3 * DAY });

    const draft = (expiresAt: Date, uploadSession: string) => ({
      formId: form.id,
      versionId: form.publishedVersionId!,
      tokenHash: shortId(40),
      data: encrypt("{}"),
      uploadSession,
      expiresAt,
    });
    await db.insert(schema.resumeDrafts).values([draft(new Date(Date.now() + 10 * DAY), resumeSession), draft(new Date(Date.now() - DAY), deadSession)]);

    const r = await retentionSweep();
    expect(r.submissions).toBeGreaterThanOrEqual(1);

    expect(await db.query.submissions.findFirst({ where: eq(schema.submissions.id, expired.submissionId) })).toBeUndefined();
    expect(await db.query.submissions.findFirst({ where: eq(schema.submissions.id, kept.submissionId) })).toBeDefined();

    expect(await exists(expiredFile.id)).toBe(false);
    expect(await objectExists(expiredFile.key)).toBe(false);
    expect(await exists(keptFile.id)).toBe(true);

    expect(await exists(oldOrphan.id)).toBe(false);
    expect(await objectExists(oldOrphan.key)).toBe(false);
    expect(await exists(freshOrphan.id)).toBe(true);
    expect(await exists(resumeUpload.id)).toBe(true);
    expect(await objectExists(resumeUpload.key)).toBe(true);
    // Abgelaufener Entwurf ist weg, damit auch sein Upload
    expect(await exists(deadDraftUpload.id)).toBe(false);

    const drafts = await db.query.resumeDrafts.findMany({ where: eq(schema.resumeDrafts.formId, form.id) });
    expect(drafts.map((d) => d.uploadSession)).toEqual([resumeSession]);

    // Audit ohne Inhalte
    const log = await db.query.auditLog.findFirst({ where: eq(schema.auditLog.action, "retention.submissions_deleted") });
    expect(log?.meta).toHaveProperty("count");
  });
});
