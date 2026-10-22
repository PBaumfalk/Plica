"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "../audit";
import { can } from "../auth/rbac";
import { assertViewer } from "../auth/session";
import { db, schema } from "../db";
import { NotFound } from "../forms/service";
import * as subs from "../submissions/service";
import { action, fail, ok, type ActionResult } from "./result";

const Ids = z.array(z.string().uuid()).min(1).max(1000);
const Status = z.enum(["new", "in_review", "approved", "rejected", "done", "spam"]);

async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return action(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof NotFound) return fail(e.message);
      throw e;
    }
  });
}

const refresh = (formId?: string) => formId && revalidatePath(`/formulare/${formId}/antworten`, "layout");

export async function setSubmissionStatusAction(formId: string, ids: string[], status: string): Promise<ActionResult<{ changed: number }>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.update");
    const changed = await subs.setStatus(v.workspace.id, v.user.id, Ids.parse(ids), Status.parse(status));
    refresh(formId);
    return ok({ changed });
  });
}

export async function changeTagsAction(formId: string, ids: string[], add: string[], remove: string[]): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.update");
    const tags = z.array(z.string().max(60)).max(30);
    await subs.changeTags(v.workspace.id, v.user.id, Ids.parse(ids), tags.parse(add), tags.parse(remove));
    refresh(formId);
    return ok(null);
  });
}

export async function setStarredAction(formId: string, ids: string[], starred: boolean): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.update");
    await subs.setStarred(v.workspace.id, v.user.id, Ids.parse(ids), starred === true);
    refresh(formId);
    return ok(null);
  });
}

export async function addNoteAction(formId: string, submissionId: string, body: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.update");
    const text = z.string().trim().min(1, "Die Notiz ist leer.").max(10_000).parse(body);
    await subs.addNote(v.workspace.id, v.user.id, z.string().uuid().parse(submissionId), text);
    refresh(formId);
    return ok(null);
  });
}

export async function deleteNoteAction(formId: string, noteId: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.update");
    try {
      await subs.deleteNote(v.workspace.id, v.user.id, noteId, can(v.role, "submissions.delete"));
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Nur eigene")) return fail(e.message);
      throw e;
    }
    refresh(formId);
    return ok(null);
  });
}

export async function deleteSubmissionsAction(formId: string, ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.delete");
    const deleted = await subs.deleteSubmissions(v.workspace.id, v.user.id, Ids.parse(ids));
    refresh(formId);
    return ok({ deleted });
  });
}

export async function saveViewAction(formId: string, name: string, query: Record<string, string>, shared: boolean): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.read");
    const q = z.record(z.string().max(40), z.string().max(400)).parse(query);
    const view = await subs.saveView(v.workspace.id, formId, v.user.id, z.string().trim().min(1, "Bitte einen Namen angeben.").max(60).parse(name), q, shared && can(v.role, "submissions.update"));
    refresh(formId);
    return ok({ id: view.id });
  });
}

export async function deleteViewAction(formId: string, viewId: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.read");
    try {
      await subs.deleteView(v.workspace.id, formId, v.user.id, viewId, can(v.role, "submissions.delete"));
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Nur eigene")) return fail(e.message);
      throw e;
    }
    refresh(formId);
    return ok(null);
  });
}

/** Ungeprüfte Datei (Quarantäne) bewusst freigeben – nur Bearbeiter und höher, protokolliert. */
export async function releaseFileAction(fileId: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.export");
    const file = await db.query.files.findFirst({ where: and(eq(schema.files.id, z.string().regex(/^[A-Za-z0-9]{8,64}$/).parse(fileId)), eq(schema.files.workspaceId, v.workspace.id)) });
    if (!file || !file.submissionId) return fail("Datei nicht gefunden.");
    if (file.status === "infected") return fail("Als schädlich erkannte Dateien können nicht freigegeben werden.");
    if (file.status !== "unscanned") return ok(null);
    await db.update(schema.files).set({ meta: { ...file.meta, releasedAt: new Date().toISOString(), releasedBy: v.user.id, releasedByName: v.user.name } }).where(eq(schema.files.id, file.id));
    await db.insert(schema.submissionEvents).values({ submissionId: file.submissionId, userId: v.user.id, type: "file_released", data: { file: file.name } });
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "file.released", targetType: "file", targetId: file.id, meta: { submissionId: file.submissionId } });
    if (file.formId) refresh(file.formId);
    return ok(null);
  });
}

/** Ungeprüfte Datei jetzt mit dem Virenscanner prüfen. */
export async function rescanFileAction(fileId: string): Promise<ActionResult<{ status: "clean" | "infected" | "unscanned"; note?: string }>> {
  return guarded(async () => {
    const v = await assertViewer("submissions.update");
    const file = await db.query.files.findFirst({ where: and(eq(schema.files.id, z.string().regex(/^[A-Za-z0-9]{8,64}$/).parse(fileId)), eq(schema.files.workspaceId, v.workspace.id)) });
    if (!file || !file.submissionId) return fail("Datei nicht gefunden.");
    const { rescanFile } = await import("../files/rescan");
    const r = await rescanFile(file.id);
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "file.rescanned", targetType: "file", targetId: file.id, meta: { status: r.status } });
    if (file.formId) refresh(file.formId);
    return ok(r);
  });
}

/* ---------------- PDF-Vorlagen ---------------- */

const TemplateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(80),
  body: z.string().max(50_000),
  isDefault: z.boolean(),
});

export async function savePdfTemplateAction(formId: string, input: z.input<typeof TemplateInput>): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const v = await assertViewer("forms.write");
    const t = TemplateInput.parse(input);
    await subs.assertForm(v.workspace.id, formId);
    const id = await db.transaction(async (tx) => {
      let tid = t.id;
      if (tid) {
        const res = await tx
          .update(schema.pdfTemplates)
          .set({ name: t.name, body: t.body, isDefault: t.isDefault, updatedAt: new Date() })
          .where(and(eq(schema.pdfTemplates.id, tid), eq(schema.pdfTemplates.formId, formId), eq(schema.pdfTemplates.workspaceId, v.workspace.id)))
          .returning({ id: schema.pdfTemplates.id });
        if (!res.length) throw new NotFound("PDF-Vorlage");
      } else {
        const [row] = await tx.insert(schema.pdfTemplates).values({ workspaceId: v.workspace.id, formId, name: t.name, body: t.body, isDefault: t.isDefault }).returning({ id: schema.pdfTemplates.id });
        tid = row.id;
      }
      // Höchstens eine Standardvorlage je Formular
      if (t.isDefault) await tx.update(schema.pdfTemplates).set({ isDefault: false }).where(and(eq(schema.pdfTemplates.formId, formId), ne(schema.pdfTemplates.id, tid)));
      return tid;
    });
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "pdf_template.saved", targetType: "form", targetId: formId, meta: { templateId: id } });
    revalidatePath(`/formulare/${formId}/pdf`);
    return ok({ id });
  });
}

export async function deletePdfTemplateAction(formId: string, templateId: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("forms.write");
    await subs.assertForm(v.workspace.id, formId);
    await db.delete(schema.pdfTemplates).where(and(eq(schema.pdfTemplates.id, z.string().uuid().parse(templateId)), eq(schema.pdfTemplates.formId, formId), eq(schema.pdfTemplates.workspaceId, v.workspace.id)));
    revalidatePath(`/formulare/${formId}/pdf`);
    return ok(null);
  });
}
