"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/result";

/** Server Action ausführen mit Ladezustand, Fehlern und Feldfehlern. */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  function run<T>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      onOk?.(r.data);
    });
  }
  return { pending, error, fieldErrors, run, setError };
}
