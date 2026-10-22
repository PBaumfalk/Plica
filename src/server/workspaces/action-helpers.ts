import "server-only";
import { action, fail, type ActionResult } from "../actions/result";
import { ServiceError } from "./errors";

/** Wie `action`, übersetzt zusätzlich fachliche Fehler in Meldungen. */
export function serviceAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return action(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ServiceError) return fail(e.message, e.field ? { [e.field]: e.message } : undefined);
      throw e;
    }
  });
}
