import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

describe("db.$count mit Filter", () => {
  it("zählt nur die gefilterten Zeilen", async () => {
    const { workspace, user } = await makeWorkspace("Zählen");
    const a = await publishedForm(workspace.id, user.id);
    const b = await publishedForm(workspace.id, user.id);
    for (let i = 0; i < 3; i++) await submit(a.slug, { answers: { name: "A", email: "a@example.de" }, ...tokenFor(a.id), clientKey: key() }, ctx);
    await submit(b.slug, { answers: { name: "B", email: "b@example.de" }, ...tokenFor(b.id), clientKey: key() }, ctx);
    expect(await db.$count(schema.submissions, eq(schema.submissions.formId, a.id))).toBe(3);
    expect(await db.$count(schema.submissions, eq(schema.submissions.formId, b.id))).toBe(1);
  });
});
