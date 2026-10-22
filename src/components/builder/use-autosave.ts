"use client";
/**
 * Automatisches Speichern mit Revisionsschutz.
 * Höchstens ein Speichervorgang gleichzeitig; Änderungen währenddessen
 * werden direkt danach nachgeschoben.
 *
 * Schutz vor Verlust beim schnellen Schließen:
 * 1. Tab wird verborgen → sofort regulär speichern.
 * 2. Seite wird verlassen (pagehide) → keepalive-Request, der das Schließen überlebt.
 * 3. Jede ungespeicherte Änderung liegt zusätzlich lokal im Browser; scheitert
 *    beides, bietet der Editor beim nächsten Öffnen die Wiederherstellung an.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormDefinition } from "@/lib/forms/schema";
import { saveDraftAction } from "@/server/actions/forms";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

type Backup = { revision: number; def: FormDefinition; at: number };
const backupKey = (formId: string) => `plica-draft:${formId}`;
// keepalive-Requests sind auf 64 KB begrenzt; größere Entwürfe sichert der lokale Speicher.
const KEEPALIVE_MAX = 60_000;

function readBackup(formId: string): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(formId));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}
function writeBackup(formId: string, b: Backup | null) {
  try {
    if (b) localStorage.setItem(backupKey(formId), JSON.stringify(b));
    else localStorage.removeItem(backupKey(formId));
  } catch {
    /* Speicher voll oder gesperrt – der keepalive-Weg bleibt */
  }
}

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
  const sentOnHide = useRef(false);

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
          if (currentVersion.current === v) writeBackup(formId, null);
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
    writeBackup(formId, { revision: revision.current, def: latest.current, at: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [version, enabled, save, formId]);

  // Nach Fehlern erneut versuchen
  useEffect(() => {
    if (status !== "error") return;
    const t = setTimeout(() => void save(), 5000);
    return () => clearTimeout(t);
  }, [status, save]);

  useEffect(() => {
    const dirty = () => savedVersion.current !== currentVersion.current && !blocked.current;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    // Tab im Hintergrund: Seite lebt weiter → regulär speichern (Revision bleibt aktuell)
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && dirty()) {
        if (timer.current) clearTimeout(timer.current);
        void save();
      }
    };
    // Seite wird verlassen: Request, der das Schließen überlebt
    const onPageHide = () => {
      if (!dirty()) return;
      const body = JSON.stringify({ definition: latest.current, revision: revision.current });
      if (body.length > KEEPALIVE_MAX) return;
      try {
        void fetch(`/api/forms/${formId}/draft`, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
        // Server-Revision ändert sich; kommt die Seite aus dem Cache zurück, neu laden
        sentOnHide.current = true;
      } catch {
        /* lokales Backup bleibt */
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && sentOnHide.current) location.reload();
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [formId, save]);

  /** Lokal gesicherte, nicht gespeicherte Änderungen vom letzten Besuch (falls abweichend). */
  const takeRecovery = useCallback((serverDef: FormDefinition): FormDefinition | null => {
    const b = readBackup(formId);
    if (!b) return null;
    if (JSON.stringify(b.def) === JSON.stringify(serverDef)) {
      writeBackup(formId, null);
      return null;
    }
    return b.def;
  }, [formId]);
  const discardRecovery = useCallback(() => writeBackup(formId, null), [formId]);

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

  return { status, error, flush, adopt, savedVersion, currentVersion, takeRecovery, discardRecovery };
}
