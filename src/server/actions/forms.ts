"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Issue } from "@/lib/forms/analyze";
import { assertViewer } from "../auth/session";
import * as forms from "../forms/service";
import { action, fail, ok, type ActionResult } from "./result";

function mapError(e: unknown): ActionResult<never> | null {
  if (e instanceof forms.NotFound) return fail(e.message);
  if (e instanceof forms.Conflict) return fail(e.message);
  if (e instanceof forms.Invalid) return { ok: false, error: e.message, fieldErrors: Object.fromEntries(e.issues.map((i, n) => [String(n), i.message])) };
  return null;
}

async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return action(async () => {
    try {
      return await fn();
    } catch (e) {
      const m = mapError(e);
      if (m) return m;
      throw e;
    }
  });
}

export async function createFormAction(input?: { definition?: unknown }): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const v = await assertViewer("forms.write");
    const f = await forms.createForm(v.workspace.id, v.user.id, input?.definition as never);
    revalidatePath("/");
    return ok({ id: f.id });
  });
}

export async function duplicateFormAction(formId: string): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const v = await assertViewer("forms.write");
    const f = await forms.duplicateForm(v.workspace.id, v.user.id, formId);
    revalidatePath("/");
    return ok({ id: f.id });
  });
}

export async function saveDraftAction(formId: string, definition: unknown, revision: number): Promise<ActionResult<{ revision: number }>> {
  return guarded(async () => {
    const v = await assertViewer("forms.write");
    const r = await forms.saveDraft(v.workspace.id, formId, definition, revision);
    return ok({ revision: r });
  });
}

export async function publishAction(formId: string): Promise<ActionResult<{ version: number; slug: string; issues?: Issue[] }>> {
  return action(async () => {
    const v = await assertViewer("forms.publish");
    try {
      const ver = await forms.publishForm(v.workspace.id, v.user.id, formId);
      revalidatePath(`/formulare/${formId}`, "layout");
      return ok({ version: ver.number, slug: ver.slug });
    } catch (e) {
      if (e instanceof forms.Invalid) return fail(`${e.message} ${e.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ")}`);
      const m = mapError(e);
      if (m) return m;
      throw e;
    }
  });
}

export async function setStatusAction(formId: string, status: "published" | "paused" | "archived" | "draft"): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("forms.publish");
    await forms.setFormStatus(v.workspace.id, v.user.id, formId, status);
    revalidatePath("/");
    revalidatePath(`/formulare/${formId}`, "layout");
    return ok(null);
  });
}

export async function deleteFormAction(formId: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("forms.delete");
    await forms.deleteForm(v.workspace.id, v.user.id, formId);
    revalidatePath("/");
    return ok(null);
  });
}

export async function restoreVersionAction(formId: string, versionId: string): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("forms.write");
    await forms.restoreVersion(v.workspace.id, v.user.id, formId, versionId);
    revalidatePath(`/formulare/${formId}`, "layout");
    return ok(null);
  });
}

const Settings = z.object({
  slug: z.string().trim().toLowerCase().optional(),
  password: z.string().max(200).nullable().optional(),
  opensAt: z.string().datetime({ offset: true }).nullable().optional(),
  closesAt: z.string().datetime({ offset: true }).nullable().optional(),
  maxSubmissions: z.number().int().min(1).max(10_000_000).nullable().optional(),
  notifyEmails: z.array(z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse")).max(20).optional(),
  retentionDays: z.number().int().min(1).max(36_500).nullable().optional(),
});

export async function updatePublishSettingsAction(formId: string, input: z.input<typeof Settings>): Promise<ActionResult<null>> {
  return guarded(async () => {
    const v = await assertViewer("forms.publish");
    const s = Settings.parse(input);
    await forms.updatePublishSettings(v.workspace.id, v.user.id, formId, {
      ...s,
      opensAt: s.opensAt === undefined ? undefined : s.opensAt ? new Date(s.opensAt) : null,
      closesAt: s.closesAt === undefined ? undefined : s.closesAt ? new Date(s.closesAt) : null,
    });
    revalidatePath(`/formulare/${formId}`, "layout");
    return ok(null);
  });
}
