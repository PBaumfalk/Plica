/**
 * „Erneut versuchen“ setzt einen fehlgeschlagenen Automationslauf fort:
 * erledigte Schritte laufen nicht noch einmal, nur die fehlgeschlagenen.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { handlers } from "@/server/queue/handlers";
import { runJob } from "@/server/queue/runner";
import { submit } from "@/server/submissions/submit";
import { ctx, key, makeWorkspace, publishedForm, tokenFor } from "./helpers";

async function runOnce(payload: Record<string, unknown>) {
  const [job] = await db.insert(schema.jobs).values({ type: "workflow.run", payload, status: "running", attempts: 1, maxAttempts: 1 }).returning();
  return runJob(job, handlers["workflow.run"]);
}

describe("Automation erneut versuchen", () => {
  it("überspringt erledigte Schritte und setzt denselben Lauf fort", async () => {
    const { workspace, user } = await makeWorkspace("Wiederholung");
    const form = await publishedForm(workspace.id, user.id);
    const r = await submit(form.slug, { answers: { name: "Erika Muster", email: "erika@example.de" }, ...tokenFor(form.id), clientKey: key() }, ctx);
    if (!r.ok) throw new Error("submit");
    const [wf] = await db
      .insert(schema.workflows)
      .values({
        workspaceId: workspace.id,
        formId: form.id,
        name: "Übergabe",
        trigger: "submission.created",
        steps: [
          { id: "s1", type: "set_status", status: "in_review" },
          // Private Adresse ist gesperrt (SSRF-Schutz) → Schritt scheitert
          { id: "s2", type: "webhook", url: "http://127.0.0.1:9/hook" },
        ],
      })
      .returning();

    await runOnce({ trigger: "submission.created", submissionId: r.submissionId, workflowId: wf.id });
    const [first] = await db.query.workflowRuns.findMany({ where: eq(schema.workflowRuns.workflowId, wf.id) });
    expect(first.status).toBe("partial");
    expect(first.doneSteps).toEqual(["s1"]);

    // Status zwischendurch von Hand ändern: Ein erneutes „Status ändern“ würde ihn überschreiben
    await db.update(schema.submissions).set({ status: "done" }).where(eq(schema.submissions.id, r.submissionId));

    await runOnce({ trigger: "submission.created", submissionId: r.submissionId, workflowId: wf.id, retryRunId: first.id });
    const runs = await db.query.workflowRuns.findMany({ where: eq(schema.workflowRuns.workflowId, wf.id) });
    expect(runs).toHaveLength(1);
    const again = runs[0];
    expect(again.status).toBe("partial");
    expect(again.log.filter((l) => l.step === "Status ändern")).toHaveLength(1);
    expect(again.log.filter((l) => l.step === "Webhook auslösen")).toHaveLength(2);
    expect(again.log.some((l) => l.step === "Erneuter Versuch")).toBe(true);
    const sub = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, r.submissionId) });
    expect(sub!.status).toBe("done");

    // Erfolgreiche Läufe lassen sich nicht „fortsetzen“
    await db.update(schema.workflowRuns).set({ status: "succeeded" }).where(eq(schema.workflowRuns.id, first.id));
    await runOnce({ trigger: "submission.created", submissionId: r.submissionId, workflowId: wf.id, retryRunId: first.id });
    expect((await db.query.workflowRuns.findMany({ where: eq(schema.workflowRuns.workflowId, wf.id) })).length).toBe(1);
  });
});
