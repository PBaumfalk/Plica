"use client";
/**
 * Automatisches Speichern mit Revisionsschutz.
 * Höchstens ein Speichervorgang gleichzeitig; Änderungen währenddessen
 * werden direkt danach nachgeschoben.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormDefinition } from "@/lib/forms/schema";
import { saveDraftAction } from "@/server/actions/forms";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

export function useAutosave(formId: string, def: FormDefinition, version: number, initialRevision: number, enabled: boolean) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(initialRevision);
  const latest = useRef(def);
  const savedVersion = useRef(0);
  const currentVersion = useRef(version);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  useLayoutEffect(() => {
    latest.current = def;
    currentVersion.current = version;
  }, [def, version]);

  const save = useCallback(async (): Promise<boolean> => {
    if (blocked.current) return false;
    if (inflight.current) {
      await inflight.current;
      if (savedVersion.current === currentVersion.current) return true;
    }
    if (savedVersion.current === currentVersion.current) return true;
    const v = currentVersion.current;
    const run = (async () => {
      setStatus("saving");
      try {
        const r = await saveDraftAction(formId, latest.current, revision.current);
        if (r.ok) {
          revision.current = r.data.revision;
          savedVersion.current = v;
          setError(null);
          setStatus(currentVersion.current === v ? "saved" : "dirty");
          return true;
        }
        if (/anderer Stelle/.test(r.error)) {
          blocked.current = true;
          setStatus("conflict");
        } else {
          setStatus("error");
          setError(r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error);
        }
        return false;
      } catch {
        setStatus("error");
        setError("Keine Verbindung zum Server.");
        return false;
      }
    })();
    inflight.current = run;
    const ok = await run;
    inflight.current = null;
    return ok;
  }, [formId]);

  useEffect(() => {
    if (!enabled || version === 0 || version === savedVersion.current || blocked.current) return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [version, enabled, save]);

  // Nach Fehlern erneut versuchen
  useEffect(() => {
    if (status !== "error") return;
    const t = setTimeout(() => void save(), 5000);
    return () => clearTimeout(t);
  }, [status, save]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (savedVersion.current !== currentVersion.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return save();
  }, [save]);

  /** Nach Konflikt oder Wiederherstellung: neue Server-Revision übernehmen. */
  const adopt = useCallback((rev: number, markSaved: boolean) => {
    revision.current = rev;
    blocked.current = false;
    if (markSaved) savedVersion.current = currentVersion.current;
    setStatus(markSaved ? "saved" : "dirty");
  }, []);

  return { status, error, flush, adopt, savedVersion, currentVersion };
}
