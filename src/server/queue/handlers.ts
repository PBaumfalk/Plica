import "server-only";
import { notifySubmission, runWorkflowJob, type WorkflowPayload } from "../workflows/run";
import { rescanPending } from "../files/rescan";
import { retentionSweep } from "./retention";
import type { JobContext } from "./runner";

export const handlers: Record<string, (ctx: JobContext) => Promise<void>> = {
  "workflow.run": (ctx) => runWorkflowJob(ctx.job.payload as unknown as WorkflowPayload, ctx),
  "notify.submission": (ctx) => notifySubmission(String(ctx.job.payload.submissionId), ctx),
  "retention.sweep": async (ctx) => {
    const r = await retentionSweep();
    await ctx.step("result", async () => r);
  },
  "file.rescan": async (ctx) => {
    const r = await rescanPending();
    await ctx.step("result", async () => r);
  },
};
