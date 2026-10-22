"use server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { assertViewer } from "../auth/session";
import { config } from "../config";
import { db, schema } from "../db";
import { audit } from "../audit";
import { slugProblem } from "../forms/service";
import { createPrefillToken } from "../prefill/service";
import { action, fail, ok, type ActionResult } from "./result";

export async function checkSlugAction(formId: string, slug: string): Promise<ActionResult<{ available: boolean; problem?: string }>> {
  return action(async () => {
    await assertViewer("forms.publish");
    const s = slug.trim().toLowerCase();
    const problem = slugProblem(s);
    if (problem) return ok({ available: false, problem });
    const taken = await db.query.forms.findFirst({ where: and(eq(schema.forms.slug, s), sql`${schema.forms.id} <> ${formId}`), columns: { id: true } });
    return ok({ available: !taken, problem: taken ? "Diese Adresse ist bereits vergeben." : undefined });
  });
}

export async function followUpTargetsAction(): Promise<ActionResult<{ id: string; title: string; slug: string }[]>> {
  return action(async () => {
    const v = await assertViewer("submissions.read");
    const rows = await db
      .select({ id: schema.forms.id, slug: schema.forms.slug, draft: schema.forms.draft })
      .from(schema.forms)
      .where(and(eq(schema.forms.workspaceId, v.workspace.id), eq(schema.forms.status, "published"), isNull(schema.forms.deletedAt)));
    return ok(rows.map((r) => ({ id: r.id, title: r.draft.title, slug: r.slug })));
  });
}

/** Signierter Link zu einem Folgeformular, vorbefüllt aus einer Antwort. */
export async function createFollowUpLinkAction(submissionId: string, targetFormId: string): Promise<ActionResult<{ url: string; matched: number }>> {
  return action(async () => {
    const v = await assertViewer("submissions.read");
    const sub = await db.query.submissions.findFirst({ where: and(eq(schema.submissions.id, submissionId), eq(schema.submissions.workspaceId, v.workspace.id)), columns: { id: true, versionId: true } });
    if (!sub) return fail("Antwort nicht gefunden.");
    const target = await db.query.forms.findFirst({ where: and(eq(schema.forms.id, targetFormId), eq(schema.forms.workspaceId, v.workspace.id), isNull(schema.forms.deletedAt)) });
    if (!target || !target.publishedVersionId || target.status !== "published") return fail("Das Zielformular ist nicht veröffentlicht.");
    const [srcV, tgtV] = await Promise.all([
      db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, sub.versionId) }),
      db.query.formVersions.findFirst({ where: eq(schema.formVersions.id, target.publishedVersionId) }),
    ]);
    const srcKeys = new Set(srcV!.definition.pages.flatMap((p) => p.fields.map((f) => f.key)));
    const matched = tgtV!.definition.pages.flatMap((p) => p.fields).filter((f) => srcKeys.has(f.key) && !["consent", "signature", "file", "calculated"].includes(f.type)).length;
    const url = `${config().publicUrl}/f/${target.slug}?prefill=${encodeURIComponent(createPrefillToken(target.id, sub.id))}`;
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "submission.follow_up_link", targetType: "submission", targetId: sub.id, meta: { targetFormId } });
    return ok({ url, matched });
  });
}
