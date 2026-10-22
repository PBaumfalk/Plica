import "server-only";
import { ZodError } from "zod";
import { AuthError } from "../auth/session";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });

/** Einheitliche Fehlerbehandlung: Details ins Log, verständliche Meldung an die Oberfläche. */
export async function action<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return fail("Bitte prüfe die markierten Angaben.", fieldErrors);
    }
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error("[action]", e);
    return fail("Das hat nicht geklappt. Details stehen im Server-Log.");
  }
}
