import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { createField, emptyDefinition, options } from "@/lib/forms/fields";
import { FormSchemaV1, type FormDefinition } from "@/lib/forms/schema";

export const OWNER = { name: "Paula Prüfer", email: "inhaber@plica.test", password: "Ein langer Satz als Passwort 2026", workspace: "Kanzlei Musterstadt" };
export const SETUP_CODE = "1111-2222-3333";
export const MAILPIT = "http://127.0.0.1:4780";

let _sql: postgres.Sql | null = null;
export function sql() {
  _sql ??= postgres("postgres://plica:plica-dev-only@127.0.0.1:4732/plica_e2e", { max: 2, onnotice: () => {} });
  return _sql;
}

/** Mandantenaufnahme-ähnliches Formular mit Logik und Upload – direkt veröffentlicht. */
export function intakeDefinition(mode: FormDefinition["settings"]["mode"] = "classic"): FormDefinition {
  const def = emptyDefinition("Mandantenaufnahme E2E");
  const t = new Set<string>();
  def.pages = [
    {
      id: "p1",
      title: "Kontakt",
      fields: [
        createField("single_choice", t, { id: "kind", key: "art", label: "Sie sind", options: options("Privatperson", "Unternehmen"), required: true }),
        createField("short_text", t, { id: "company", key: "firma", label: "Firmenname", required: true }),
        createField("short_text", t, { id: "name", key: "name", label: "Ihr Name", required: true }),
        createField("email", t, { id: "email", key: "email", label: "E-Mail", required: true }),
      ],
    },
    {
      id: "p2",
      title: "Anliegen",
      fields: [
        createField("long_text", t, { id: "matter", key: "anliegen", label: "Worum geht es, {{name}}?", required: true }),
        createField("file", t, { id: "doc", key: "unterlagen", label: "Unterlagen", accept: ["application/pdf", "image/png"] }),
      ],
    },
  ];
  def.rules = [{ id: "r1", enabled: true, match: "all", conditions: [{ fieldId: "kind", operator: "eq", value: "Unternehmen" }], actions: [{ type: "show", target: "company" }] }];
  def.settings.mode = mode;
  return FormSchemaV1.parse(def);
}

export async function seedPublishedForm(slug: string, def: FormDefinition, notify: string[] = []) {
  const db = sql();
  const [ws] = await db`select w.id, m.user_id from workspaces w join memberships m on m.workspace_id = w.id where m.role = 'owner' order by w.created_at limit 1`;
  const [f] = await db`insert into forms (workspace_id, slug, status, draft, created_by, notify_emails) values (${ws.id}, ${slug}, 'published', ${db.json(def as never)}, ${ws.user_id}, ${db.json(notify)}) returning id`;
  const [v] = await db`insert into form_versions (form_id, number, definition, published_by) values (${f.id}, 1, ${db.json(def as never)}, ${ws.user_id}) returning id`;
  await db`update forms set published_version_id = ${v.id} where id = ${f.id}`;
  return { formId: f.id as string, versionId: v.id as string, workspaceId: ws.id as string };
}

export async function submissionsOf(formId: string) {
  return sql()`select id, number, data, status from submissions where form_id = ${formId} order by number`;
}

export const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

/** Wartet, bis Mailpit eine Nachricht an `to` mit passendem Betreff hat. */
export async function waitForMail(to: string, subject: RegExp, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`).then((x) => x.json()).catch(() => null);
    const hit = r?.messages?.find((m: { Subject: string }) => subject.test(m.Subject));
    if (hit) return hit as { ID: string; Subject: string };
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Keine E-Mail an ${to} mit Betreff ${subject}`);
}

/** Die Seite verlangt eine Mindest-Ausfüllzeit (Spam-Schutz). */
export async function humanPause(page: Page) {
  await page.waitForTimeout(2700);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
