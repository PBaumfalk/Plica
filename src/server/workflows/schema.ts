/** Eingabeschema für Workflows – gemeinsam für Oberfläche und Server. */
import { z } from "zod";

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const StepSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("email"), to: z.string().trim().min(1, "Bitte Empfänger angeben.").max(1000), subject: z.string().trim().min(1, "Bitte einen Betreff angeben.").max(300), body: z.string().max(20_000), attachPdf: z.boolean().optional() }),
  z.object({ id, type: z.literal("confirmation"), subject: z.string().trim().min(1, "Bitte einen Betreff angeben.").max(300), body: z.string().max(20_000), attachPdf: z.boolean().optional() }),
  z.object({ id, type: z.literal("webhook"), url: z.string().trim().url("Bitte eine gültige Adresse angeben.").max(2000) }),
  z.object({ id, type: z.literal("set_status"), status: z.enum(["new", "in_review", "approved", "rejected", "done"]) }),
  z.object({ id, type: z.literal("approval"), title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(300), assigneeRole: z.enum(["owner", "admin", "editor", "reviewer"]) }),
  z.object({ id, type: z.literal("pdf") }),
]);

export const ConditionSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z
    .array(
      z.object({
        fieldId: z.string().min(1).max(64),
        operator: z.enum(["eq", "neq", "contains", "not_contains", "gt", "gte", "lt", "lte", "empty", "not_empty", "in", "not_in"]),
        value: z.union([z.string().max(1000), z.number(), z.boolean(), z.array(z.string().max(500)).max(100)]).optional(),
      }),
    )
    .max(20),
});

export const WorkflowInput = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(120),
  enabled: z.boolean(),
  trigger: z.enum(["submission.created", "submission.status_changed", "approval.approved", "approval.rejected"]),
  triggerStatus: z.enum(["new", "in_review", "approved", "rejected", "done"]).nullable(),
  condition: ConditionSchema.nullable(),
  steps: z.array(StepSchema).max(20),
  elseSteps: z.array(StepSchema).max(20),
});
export type WorkflowInputT = z.infer<typeof WorkflowInput>;
