"use server";
import { revalidatePath } from "next/cache";
import { assertViewer } from "../auth/session";
import { retryProblem } from "../queue/problems";
import { action, fail, ok, type ActionResult } from "./result";

export async function retryJobAction(jobId: number): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer("workflows.write");
    if (!Number.isInteger(jobId) || jobId <= 0) return fail("Ungültige Anfrage.");
    if (!(await retryProblem(v.workspace.id, v.user.id, jobId))) return fail("Dieser Vorgang wurde nicht gefunden.");
    revalidatePath("/", "layout");
    return ok(null);
  });
}
