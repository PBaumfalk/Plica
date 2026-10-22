"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormRenderer, type SubmitOutcome } from "@/components/form/renderer";
import type { Answers } from "@/lib/forms/logic";
import type { FormDefinition } from "@/lib/forms/schema";
import type { FileRef } from "@/lib/forms/validate";
import { ResumeButton } from "@/components/share/resume-button";

/** Auch ein schlichtes iframe ohne embed.js zählt als Einbettung. */
function inFrame() {
  try {
    return window.top !== window.self;
  } catch {
    return true; // fremde Herkunft blockiert den Zugriff → eingebettet
  }
}

function rid(n = 20) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

export function PublicForm({ slug, definition, token, initialAnswers, embedded, prefillFrom, resumeToken, initialPageId }: { slug: string; definition: FormDefinition; token: string; initialAnswers: Answers; embedded: boolean; prefillFrom?: string; resumeToken?: string; initialPageId?: string }) {
  // Nach „Formular wurde aktualisiert“ + Neuladen: gesicherte Angaben übernehmen (nur einmal)
  const [restored, setRestored] = useState<Answers | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`plica-answers:${slug}`);
      if (!raw) return;
      sessionStorage.removeItem(`plica-answers:${slug}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestored(JSON.parse(raw) as Answers);
    } catch {}
  }, [slug]);
  const visit = useMemo(() => rid(16), []);
  // Idempotenzschlüssel: bleibt bei erneutem Absenden derselbe
  const clientKey = useRef(rid(24));
  const base = `/api/public/forms/${encodeURIComponent(slug)}`;
  // Fortsetzungslink dieser Sitzung (wird bei erneutem Speichern aktualisiert)
  const resume = useRef<string | undefined>(resumeToken);
  const [resumeHandle] = useState(() => ({ get: () => resume.current, set: (t: string) => void (resume.current = t) }));

  const event = useCallback(
    (type: "view" | "start" | "page" | "submit", pageId?: string) => {
      const body = JSON.stringify({ visit, type, pageId });
      if (navigator.sendBeacon) navigator.sendBeacon(`${base}/events`, new Blob([body], { type: "application/json" }));
      else void fetch(`${base}/events`, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    },
    [base, visit],
  );

  useEffect(() => {
    event("view");
  }, [event]);

  // Einbettung: Höhe an die Elternseite melden (embed.js)
  useEffect(() => {
    if (!embedded || window.parent === window) return;
    const post = () => window.parent.postMessage({ plica: "resize", slug, height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, [embedded, slug]);

  const upload = useCallback(
    (fieldId: string, file: File, onProgress: (p: number) => void) =>
      new Promise<FileRef>((resolve, reject) => {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("fieldId", fieldId);
        fd.set("file", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${base}/upload`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.onload = () => {
          let data: { error?: { message?: string } } & Partial<FileRef> = {};
          try {
            data = JSON.parse(xhr.responseText);
          } catch {}
          if (xhr.status === 200 && data.id) resolve(data as FileRef);
          else reject(new Error(data.error?.message ?? "Hochladen fehlgeschlagen."));
        };
        xhr.onerror = () => reject(new Error("Keine Verbindung. Bitte erneut versuchen."));
        xhr.send(fd);
      }),
    [base, token],
  );

  async function onSubmit(answers: Answers, meta: { durationMs: number }): Promise<SubmitOutcome> {
    const honeypot = (document.getElementById("plica-website") as HTMLInputElement | null)?.value ?? "";
    const send = () =>
      fetch(`${base}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, token, clientKey: clientKey.current, honeypot, meta: { ...meta, embedded: embedded || inFrame(), prefill: prefillFrom } }),
      });
    let res = await send();
    let data = await res.json().catch(() => ({}));
    // Sehr schnell abgeschickt (z. B. Autofill): kurz warten und einmal still erneut senden
    const wait = Number(data.error?.retryAfterMs);
    if (res.status === 429 && wait > 0 && wait <= 5000) {
      await new Promise((r) => setTimeout(r, wait));
      res = await send();
      data = await res.json().catch(() => ({}));
    }
    if (res.ok) {
      // Gespeicherten Zwischenstand nach dem Absenden entfernen
      if (resume.current) void fetch(`${base}/resume`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ resume: resume.current }), keepalive: true });
      return { ok: true, endingId: data.endingId, number: data.number };
    }
    // Formular wurde während des Ausfüllens aktualisiert: Angaben im Tab sichern, nach dem Neuladen zurückholen
    if (res.status === 409 && data.error?.code === "form_updated") {
      try {
        sessionStorage.setItem(`plica-answers:${slug}`, JSON.stringify(answers));
      } catch {}
    }
    return { ok: false, error: data.error?.message ?? "Das Absenden hat nicht geklappt.", errors: data.error?.fields };
  }

  return (
    <>
      {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="plica-website">Website</label>
        <input id="plica-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <FormRenderer
        key={restored ? "restored" : "initial"}
        definition={definition}
        initialAnswers={restored ? { ...initialAnswers, ...restored } : initialAnswers}
        initialPageId={initialPageId}
        onSubmit={onSubmit}
        uploads={{ upload }}
        onEvent={(t, p) => event(t, p)}
        embedded={embedded}
        footerExtra={definition.settings.allowResume ? (answers, pageId) => <ResumeButton endpoint={`${base}/resume`} token={token} answers={answers} pageId={pageId} resume={resumeHandle} /> : undefined}
      />
    </>
  );
}
