/**
 * Autorisierung: Rollenmatrix vollständig, und kein Zugriff über
 * Workspace-Grenzen hinweg (IDOR) – Formulare, Antworten, Dateien.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { can, canAssign, PERMISSIONS, type Permission } from "@/server/auth/rbac";
import type { Role } from "@/server/db/schema";
import { db, schema } from "@/server/db";
import * as forms from "@/server/forms/service";
import * as subs from "@/server/submissions/service";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

const EXPECTED: Record<Role, Permission[]> = {
  viewer: ["forms.read", "submissions.read"],
  reviewer: ["forms.read", "submissions.read", "submissions.update", "approvals.decide"],
  editor: ["forms.read", "submissions.read", "submissions.update", "approvals.decide", "forms.write", "forms.publish", "submissions.export", "workflows.write"],
  admin: ["forms.read", "submissions.read", "submissions.update", "approvals.decide", "forms.write", "forms.publish", "submissions.export", "workflows.write", "forms.delete", "submissions.delete", "members.manage", "workspace.manage", "tokens.manage", "audit.read"],
  owner: [...PERMISSIONS],
};

describe("Rollenmatrix", () => {
  for (const role of Object.keys(EXPECTED) as Role[]) {
    it(`${role}: genau die vorgesehenen Rechte`, () => {
      for (const p of PERMISSIONS) expect(can(role, p), `${role} ${p}`).toBe(EXPECTED[role].includes(p));
    });
  }
  it("ohne Rolle: nichts", () => {
    for (const p of PERMISSIONS) expect(can(null, p)).toBe(false);
  });
  it("Admins können niemanden zum Admin oder Inhaber machen", () => {
    expect(canAssign("admin", "admin")).toBe(false);
    expect(canAssign("admin", "owner")).toBe(false);
    expect(canAssign("admin", "editor")).toBe(true);
    expect(canAssign("editor", "viewer")).toBe(false);
    expect(canAssign("owner", "owner")).toBe(true);
  });
});

describe("Workspace-Isolation (IDOR)", () => {
  let A: Awaited<ReturnType<typeof makeWorkspace>>;
  let B: Awaited<ReturnType<typeof makeWorkspace>>;
  let formA: Awaited<ReturnType<typeof publishedForm>>;
  let subId: string;

  beforeAll(async () => {
    A = await makeWorkspace("Kanzlei A");
    B = await makeWorkspace("Kanzlei B");
    formA = await publishedForm(A.workspace.id, A.user.id);
    const t = tokenFor(formA.id);
    const r = await submit(formA.slug, { answers: { name: "Erika Muster", email: "erika@example.de" }, token: t.token, clientKey: key() }, ctx);
    if (!r.ok) throw new Error(r.error);
    subId = r.submissionId;
  });

  it("Formular aus A ist für B unsichtbar", async () => {
    await expect(forms.getForm(B.workspace.id, formA.id)).rejects.toBeInstanceOf(forms.NotFound);
    expect((await forms.listForms(B.workspace.id)).map((f) => f.id)).not.toContain(formA.id);
    await expect(forms.saveDraft(B.workspace.id, formA.id, formA.draft, formA.draftRevision)).rejects.toBeInstanceOf(forms.NotFound);
    await expect(forms.publishForm(B.workspace.id, B.user.id, formA.id)).rejects.toBeInstanceOf(forms.NotFound);
    await expect(forms.setFormStatus(B.workspace.id, B.user.id, formA.id, "paused")).rejects.toBeInstanceOf(forms.NotFound);
    await expect(forms.deleteForm(B.workspace.id, B.user.id, formA.id)).rejects.toBeInstanceOf(forms.NotFound);
    await expect(forms.updatePublishSettings(B.workspace.id, B.user.id, formA.id, { slug: "gekapert" })).rejects.toBeInstanceOf(forms.NotFound);
    await expect(forms.listVersions(B.workspace.id, formA.id)).rejects.toBeInstanceOf(forms.NotFound);
  });

  it("Antwort aus A ist für B unsichtbar und unveränderbar", async () => {
    await expect(subs.getSubmission(B.workspace.id, subId)).rejects.toThrow();
    await expect(subs.listSubmissions(B.workspace.id, formA.id, subs.parseListQuery({}))).rejects.toThrow();
    expect(await subs.setStatus(B.workspace.id, B.user.id, [subId], "done")).toBe(0);
    expect(await subs.deleteSubmissions(B.workspace.id, B.user.id, [subId])).toBe(0);
    const still = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, subId) });
    expect(still?.status).toBe("new");
    // A sieht die eigene Antwort
    expect((await subs.getSubmission(A.workspace.id, subId)).submission.id).toBe(subId);
  });

  it("ungültige IDs verhalten sich wie nicht vorhanden (keine SQL-Fehler)", async () => {
    await expect(forms.getForm(A.workspace.id, "1 or 1=1")).rejects.toBeInstanceOf(forms.NotFound);
    await expect(subs.getSubmission(A.workspace.id, "'; drop table submissions; --")).rejects.toThrow();
    expect(await db.$count(schema.submissions, and(eq(schema.submissions.id, subId)))).toBe(1);
  });
});
