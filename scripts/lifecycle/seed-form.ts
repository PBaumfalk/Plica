// Lebenszyklustest: gibt SQL aus, das ein veröffentlichtes Kontaktformular mit Datei-Upload anlegt.
import { createField, emptyDefinition } from "@/lib/forms/fields";
import { FormSchemaV1 } from "@/lib/forms/schema";
const def = emptyDefinition("Kontaktanfrage");
const t = new Set<string>();
def.pages[0].fields = [
  createField("short_text", t, { id: "name", key: "name", label: "Ihr Name", required: true }),
  createField("email", t, { id: "email", key: "email", label: "E-Mail", required: true }),
  createField("long_text", t, { id: "msg", key: "nachricht", label: "Nachricht" }),
  createField("file", t, { id: "doc", key: "dokument", label: "Unterlagen", accept: ["application/pdf"] }),
];
const json = JSON.stringify(FormSchemaV1.parse(def)).replace(/'/g, "''");
const slug = process.argv[2] ?? "kontakt";
console.log(`with w as (select id from workspaces limit 1), u as (select id from users limit 1),
f as (insert into forms (workspace_id, slug, status, draft, created_by) select w.id, '${slug}', 'published', '${json}'::jsonb, u.id from w, u returning id),
v as (insert into form_versions (form_id, number, definition) select f.id, 1, '${json}'::jsonb from f returning id, form_id)
select 1;
update forms set published_version_id = (select id from form_versions where form_versions.form_id = forms.id order by number desc limit 1) where published_version_id is null;`);
