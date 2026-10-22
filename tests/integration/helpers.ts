import { createField, emptyDefinition, options } from "@/lib/forms/fields";
import { FormSchemaV1, type FormDefinition } from "@/lib/forms/schema";
import { db, schema } from "@/server/db";
import { encrypt, randomToken, shortId, signPayload } from "@/server/lib/crypto";
import { createForm, publishForm } from "@/server/forms/service";

export async function makeWorkspace(name: string, role: "owner" | "admin" | "editor" | "reviewer" | "viewer" = "owner") {
  const [w] = await db.insert(schema.workspaces).values({ name, webhookSecret: encrypt(randomToken(), "webhook") }).returning();
  const [u] = await db.insert(schema.users).values({ email: `${randomToken(6).toLowerCase()}@test.plica`, name, passwordHash: "x" }).returning();
  await db.insert(schema.memberships).values({ workspaceId: w.id, userId: u.id, role });
  return { workspace: w, user: u };
}

/** Kontaktformular mit bedingtem Feld und Datei-Upload. */
export function contactDefinition(): FormDefinition {
  const def = emptyDefinition("Kontakt");
  const t = new Set<string>();
  def.pages[0].fields = [
    createField("short_text", t, { id: "name", key: "name", label: "Name", required: true }),
    createField("email", t, { id: "email", key: "email", label: "E-Mail", required: true }),
    createField("single_choice", t, { id: "kind", key: "art", label: "Art", options: options("Privat", "Firma") }),
    createField("short_text", t, { id: "company", key: "firma", label: "Firma" }),
    createField("file", t, { id: "doc", key: "dokument", label: "Dokument", accept: ["application/pdf", "image/png"] }),
  ];
  def.rules = [{ id: "r1", enabled: true, match: "all", conditions: [{ fieldId: "kind", operator: "eq", value: "Firma" }], actions: [{ type: "show", target: "company" }] }];
  return FormSchemaV1.parse(def);
}

export async function publishedForm(workspaceId: string, userId: string, def = contactDefinition()) {
  const form = await createForm(workspaceId, userId, def);
  await publishForm(workspaceId, userId, form.id);
  return (await db.query.forms.findFirst({ where: (f, { eq }) => eq(f.id, form.id) }))!;
}

/** Formular-Token, als wäre die Seite vor 10 s geladen worden. */
export function tokenFor(formId: string, uploadSession = shortId(24), ageMs = 10_000) {
  return { token: signPayload({ f: formId, t: Date.now() - ageMs, u: uploadSession }, "form", 3600), uploadSession };
}

export const ctx = { userAgent: "vitest", ipHash: "testhash" };
export const key = () => randomToken(18).replace(/[^A-Za-z0-9_-]/g, "a");
