"use server";
/**
 * Bausteine (wiederverwendbare Feldgruppen) und Editor-Hilfen.
 * Alles workspace-gebunden; fremde IDs führen zu „nicht gefunden“.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { FieldSchema, type Field, type FormDefinition } from "@/lib/forms/schema";
import { audit } from "../audit";
import { assertViewer } from "../auth/session";
import { db, schema } from "../db";
import { getForm } from "../forms/service";
import { action, fail, ok, type ActionResult } from "./result";

export interface BlockSummary {
  id: string;
  name: string;
  description: string | null;
  fields: Field[];
}

export async function listBlocksAction(): Promise<ActionResult<BlockSummary[]>> {
  return action(async () => {
    const v = await assertViewer("forms.read");
    const rows = await db.select().from(schema.blocks).where(eq(schema.blocks.workspaceId, v.workspace.id)).orderBy(desc(schema.blocks.createdAt));
    return ok(rows.map((r) => ({ id: r.id, name: r.name, description: r.description, fields: r.fields as Field[] })));
  });
}

const SaveBlock = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(80),
  description: z.string().trim().max(300).optional(),
  fields: z.array(FieldSchema).min(1, "Ein Baustein braucht mindestens ein Feld.").max(50),
});

export async function saveBlockAction(input: z.input<typeof SaveBlock>): Promise<ActionResult<BlockSummary>> {
  return action(async () => {
    const v = await assertViewer("forms.write");
    const data = SaveBlock.parse(input);
    const [row] = await db
      .insert(schema.blocks)
      .values({ workspaceId: v.workspace.id, name: data.name, description: data.description || null, fields: data.fields, createdBy: v.user.id })
      .returning();
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "block.created", targetType: "block", targetId: row.id });
    return ok({ id: row.id, name: row.name, description: row.description, fields: row.fields as Field[] });
  });
}

export async function deleteBlockAction(id: string): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer("forms.write");
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Baustein nicht gefunden.");
    const res = await db.delete(schema.blocks).where(and(eq(schema.blocks.id, id), eq(schema.blocks.workspaceId, v.workspace.id))).returning({ id: schema.blocks.id });
    if (!res.length) return fail("Baustein nicht gefunden.");
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "block.deleted", targetType: "block", targetId: id });
    return ok(null);
  });
}

/** Aktueller Entwurf und Revision – für Konfliktauflösung und Wiederherstellen. */
export async function getDraftStateAction(formId: string): Promise<ActionResult<{ revision: number; definition: FormDefinition }>> {
  return action(async () => {
    const v = await assertViewer("forms.read");
    const form = await getForm(v.workspace.id, formId).catch(() => null);
    if (!form) return fail("Formular nicht gefunden.");
    return ok({ revision: form.draftRevision, definition: form.draft });
  });
}
