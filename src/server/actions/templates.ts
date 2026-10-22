"use server";
import { revalidatePath } from "next/cache";
import type { FormDefinition } from "@/lib/forms/schema";
import { TEMPLATES, templateById } from "@/lib/templates";
import { audit } from "../audit";
import { assertViewer } from "../auth/session";
import { createForm } from "../forms/service";
import { aiConfigured, generateDefinition, type GenerateSource } from "../ai/generate";
import { action, fail, ok, type ActionResult } from "./result";

export async function createFromTemplateAction(templateId: string): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const v = await assertViewer("forms.write");
    const t = templateById(templateId);
    if (!t) return fail("Diese Vorlage gibt es nicht.");
    const f = await createForm(v.workspace.id, v.user.id, t.build());
    revalidatePath("/");
    return ok({ id: f.id });
  });
}

/** Legt alle Vorlagen als Entwürfe an (Beispielsammlung beim ersten Start). */
export async function createSampleCollectionAction(): Promise<ActionResult<{ count: number }>> {
  return action(async () => {
    const v = await assertViewer("forms.write");
    for (const t of TEMPLATES) await createForm(v.workspace.id, v.user.id, t.build());
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "templates.sample_collection", meta: { count: TEMPLATES.length } });
    revalidatePath("/");
    return ok({ count: TEMPLATES.length });
  });
}

export async function generateFromDescriptionAction(text: string): Promise<ActionResult<{ definition: FormDefinition; source: GenerateSource; note?: string }>> {
  return action(async () => {
    await assertViewer("forms.write");
    const t = String(text ?? "").trim();
    if (t.length < 3) return fail("Bitte beschreibe das Formular in ein paar Worten.");
    if (t.length > 4000) return fail("Die Beschreibung ist zu lang (höchstens 4000 Zeichen).");
    return ok(await generateDefinition(t));
  });
}

export async function aiStatusAction(): Promise<boolean> {
  await assertViewer("forms.write");
  return aiConfigured();
}
