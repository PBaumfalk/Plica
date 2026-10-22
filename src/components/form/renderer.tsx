"use client";
/**
 * Formular-Renderer: Classic (alles untereinander), Cards (eine Frage pro
 * Bildschirm) und Wizard (Abschnitte mit Fortschritt und Zusammenfassung).
 * Alle drei teilen dieselbe Logik- und Validierungs-Engine.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CornerDownLeft, Loader2, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatValue } from "@/lib/forms/format";
import { computeState, interpolate, isEmpty, type Answers } from "@/lib/forms/logic";
import { fieldIndex, isInputField, type Ending, type Field, type FormDefinition, type Theme } from "@/lib/forms/schema";
import { checkField, validateSubmission } from "@/lib/forms/validate";
import { FieldInput, type UploadContext } from "./field-input";

export type RenderMode = FormDefinition["settings"]["mode"];

export interface SubmitOutcome {
  ok: boolean;
  endingId?: string;
  number?: number;
  error?: string;
  errors?: Record<string, string>;
}

export interface FormRendererProps {
  definition: FormDefinition;
  mode?: RenderMode;
  initialAnswers?: Answers;
  /** Vorschau: nichts wird gesendet. */
  preview?: boolean;
  onSubmit?: (answers: Answers, meta: { durationMs: number }) => Promise<SubmitOutcome>;
  uploads?: UploadContext;
  onEvent?: (type: "start" | "page" | "submit", pageId?: string) => void;
  /** Zusätzliche Aktion unten (z. B. „Später fortsetzen“). */
  footerExtra?: (answers: Answers, pageId: string) => ReactNode;
  initialPageId?: string;
  className?: string;
  embedded?: boolean;
}

const RADII = { none: "0px", small: "5px", medium: "9px", large: "16px" } as const;
const FONTS = { sans: "var(--font-sans)", serif: "var(--font-display)", mono: "var(--font-mono)" } as const;

/** Relative Leuchtdichte nach WCAG – entscheidet über helle oder dunkle Schrift auf dem Akzent. */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function themeStyle(theme: Theme): CSSProperties {
  return {
    ["--f-accent-base" as string]: theme.accent,
    ["--f-accent-ink-base" as string]: luminance(theme.accent) > 0.42 ? "#14161b" : "#ffffff",
    ["--f-radius" as string]: RADII[theme.radius],
    ["--f-body" as string]: FONTS[theme.font],
  };
}

const fmt = (f: Field, v: unknown) => formatValue(f, v);

export function FormRenderer(props: FormRendererProps) {
  const { definition: def, preview, onSubmit, uploads, onEvent } = props;
  const mode = props.mode ?? def.settings.mode;
  const [answers, setAnswers] = useState<Answers>(() => ({ ...defaults(def), ...props.initialAnswers }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState<Ending | null>(null);
  const started = useRef(0);
  const touched = useRef(false);
  // Startzeit erst im Browser setzen (Ausfülldauer für die Auswertung)
  useEffect(() => {
    started.current = Date.now();
  }, []);

  const state = useMemo(() => computeState(def, answers), [def, answers]);
  const index = useMemo(() => fieldIndex(def), [def]);
  const pages = useMemo(() => state.pages.map((id) => def.pages.find((p) => p.id === id)!).filter(Boolean), [state.pages, def.pages]);
  const text = useCallback((s: string) => interpolate(s, def, { ...answers, ...state.computed }, fmt), [def, answers, state.computed]);

  const setValue = useCallback(
    (id: string, v: unknown) => {
      if (!touched.current) {
        touched.current = true;
        onEvent?.("start");
      }
      setAnswers((a) => ({ ...a, [id]: v }));
      setErrors((e) => {
        if (!e[id] && !Object.keys(e).some((k) => k.startsWith(`${id}.`))) return e;
        const next = { ...e };
        for (const k of Object.keys(next)) if (k === id || k.startsWith(`${id}.`)) delete next[k];
        return next;
      });
    },
    [onEvent],
  );

  async function doSubmit() {
    const r = validateSubmission(def, answers);
    if (!r.ok) {
      setErrors(r.errors);
      return { ok: false as const, errors: r.errors };
    }
    if (preview || !onSubmit) {
      setEnding(r.state.ending);
      return { ok: true as const };
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await onSubmit(answers, { durationMs: Date.now() - started.current });
      if (!res.ok) {
        setFormError(res.error ?? "Das Absenden hat nicht geklappt.");
        if (res.errors) setErrors(res.errors);
        return { ok: false as const, errors: res.errors ?? {} };
      }
      onEvent?.("submit");
      const end = def.endings.find((e) => e.id === res.endingId) ?? r.state.ending;
      if (end.redirectUrl && /^https?:\/\//.test(end.redirectUrl)) {
        window.top!.location.href = end.redirectUrl;
        return { ok: true as const };
      }
      setEnding(end);
      return { ok: true as const };
    } catch {
      setFormError("Keine Verbindung zum Server. Ihre Angaben sind noch da – bitte erneut versuchen.");
      return { ok: false as const, errors: {} };
    } finally {
      setSubmitting(false);
    }
  }

  const blurCheck = useCallback(
    (f: Field) => {
      const v = answers[f.id];
      if (isEmpty(v)) return;
      const err = checkField(f, v, false, def.settings.language).error;
      if (err) setErrors((e) => ({ ...e, [f.id]: err }));
    },
    [answers, def.settings.language],
  );
  const common = { preview, blurCheck, def, answers, state, errors, setValue, text, uploads, submitting, formError, doSubmit, index };

  return (
    <div className={cn("plica-form @container", props.className)} style={themeStyle(def.settings.theme)}>
      {ending ? (
        <EndingView ending={ending} text={text} preview={preview} />
      ) : mode === "cards" ? (
        <CardsMode {...common} pagesOrder={pages} onEvent={onEvent} footerExtra={props.footerExtra} initialPageId={props.initialPageId} />
      ) : mode === "wizard" ? (
        <WizardMode {...common} pagesOrder={pages} onEvent={onEvent} footerExtra={props.footerExtra} initialPageId={props.initialPageId} setErrors={setErrors} />
      ) : (
        <ClassicMode {...common} pagesOrder={pages} footerExtra={props.footerExtra} />
      )}
    </div>
  );
}

function defaults(def: FormDefinition): Answers {
  const a: Answers = {};
  for (const { field, parent } of fieldIndex(def).values()) {
    if (parent || field.defaultValue === undefined || field.defaultValue === null || field.defaultValue === "") continue;
    a[field.id] = field.defaultValue;
  }
  return a;
}

type Common = {
  preview?: boolean;
  blurCheck: (field: Field) => void;
  def: FormDefinition;
  answers: Answers;
  state: ReturnType<typeof computeState>;
  errors: Record<string, string>;
  setValue: (id: string, v: unknown) => void;
  text: (s: string) => string;
  uploads?: UploadContext;
  submitting: boolean;
  formError: string | null;
  doSubmit: () => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  index: ReturnType<typeof fieldIndex>;
  pagesOrder: FormDefinition["pages"];
};

function childErrors(errors: Record<string, string>, fieldId: string) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) if (k.startsWith(`${fieldId}.`)) out[k.slice(fieldId.length + 1)] = v;
  return out;
}

const BLUR_CHECK = new Set<Field["type"]>(["short_text", "long_text", "email", "phone", "number", "currency", "date", "time", "datetime", "date_range"]);

function RenderField({ field, c, large, autoFocus, onEnter }: { field: Field; c: Common; large?: boolean; autoFocus?: boolean; onEnter?: () => void }) {
  if (!c.state.visible.has(field.id) || field.type === "hidden") return null;
  const input = (
    <FieldInput
      field={field}
      label={c.text(field.label)}
      description={field.description ? c.text(field.description) : undefined}
      value={c.answers[field.id]}
      onChange={(v) => c.setValue(field.id, v)}
      error={c.errors[field.id]}
      childErrors={field.type === "group" ? childErrors(c.errors, field.id) : undefined}
      required={c.state.required.has(field.id)}
      computed={c.state.computed[field.id]}
      uploads={c.uploads}
      disabled={c.submitting}
      large={large}
      autoFocus={autoFocus}
      onEnter={onEnter}
    />
  );
  if (!BLUR_CHECK.has(field.type)) return input;
  // Formatfehler beim Verlassen des Feldes zeigen (leere Pflichtfelder erst beim Absenden)
  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) c.blurCheck(field);
      }}
    >
      {input}
    </div>
  );
}

function FieldGrid({ fields, c }: { fields: Field[]; c: Common }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-7 @lg:grid-cols-2">
      {fields.map((f) =>
        c.state.visible.has(f.id) && f.type !== "hidden" ? (
          <div key={f.id} className={cn("min-w-0 animate-fade-in", f.width !== "half" && "@lg:col-span-2")}>
            <RenderField field={f} c={c} />
          </div>
        ) : null,
      )}
    </div>
  );
}

function Header({ def, text, compact, preview }: { def: FormDefinition; text: (s: string) => string; compact?: boolean; preview?: boolean }) {
  // In der Vorschau innerhalb der Verwaltung hat die Seite schon eine h1
  const H = preview ? "h2" : "h1";
  return (
    <header className={cn(compact ? "mb-6" : "mb-9")}>
      {def.settings.theme.logoFileId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/public/assets/${def.settings.theme.logoFileId}`} alt="" className="mb-6 h-10 w-auto max-w-[200px] object-contain" />
      )}
      <H className="font-[family-name:var(--f-display)] text-[clamp(26px,5vw,36px)] leading-[1.12] font-[450] tracking-[-0.015em] text-[var(--f-ink)]">{text(def.title)}</H>
      {def.description && <p className="mt-3 whitespace-pre-line text-[15.5px] leading-relaxed text-[var(--f-muted)]">{text(def.description)}</p>}
    </header>
  );
}

function SubmitButton({ c, label, onClick, icon }: { c: Common; label?: string; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={c.submitting}
      className="inline-flex h-12 items-center gap-2 rounded-[var(--f-radius)] bg-[var(--f-accent)] px-6 text-[15.5px] font-semibold text-[var(--f-accent-ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.15)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
    >
      {c.submitting ? <Loader2 className="size-4 animate-spin" /> : null}
      {label ?? c.def.settings.submitLabel}
      {!c.submitting && icon}
    </button>
  );
}

function FormErrorBox({ c }: { c: Common }) {
  const count = Object.keys(c.errors).length;
  if (!c.formError && count === 0) return null;
  return (
    <div role="alert" className="rounded-[var(--f-radius)] border border-[color-mix(in_srgb,var(--f-bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--f-bad)_7%,transparent)] px-4 py-3 text-[14px] text-[var(--f-bad)]">
      {c.formError ?? (count === 1 ? "Eine Angabe fehlt oder ist ungültig." : `${count} Angaben fehlen oder sind ungültig.`)}
    </div>
  );
}

function focusFirstError(errors: Record<string, string>) {
  const first = Object.keys(errors)[0]?.split(".")[0];
  if (!first) return;
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input, textarea, select, button, canvas")?.focus({ preventScroll: true });
  });
}

/* ---------------- Classic ---------------- */

function ClassicMode(c: Common & { footerExtra?: FormRendererProps["footerExtra"] }) {
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await c.doSubmit();
        if (!r.ok && r.errors) focusFirstError(r.errors);
      }}
    >
      <Header def={c.def} text={c.text} preview={c.preview} />
      <div className="space-y-12">
        {c.pagesOrder.map((p, i) => (
          <section key={p.id} aria-labelledby={p.title ? `sec-${p.id}` : undefined} className="space-y-7">
            {(p.title || (i > 0 && c.pagesOrder.length > 1)) && (
              <div className={cn(i > 0 && "border-t border-[var(--f-line)] pt-8")}>
                {p.title && <h2 id={`sec-${p.id}`} className="font-[family-name:var(--f-display)] text-[22px] font-[450] tracking-[-0.01em]">{c.text(p.title)}</h2>}
                {p.description && <p className="mt-1.5 whitespace-pre-line text-[14.5px] text-[var(--f-muted)]">{c.text(p.description)}</p>}
              </div>
            )}
            <FieldGrid fields={p.fields} c={c} />
          </section>
        ))}
      </div>
      <div className="mt-10 space-y-4">
        <FormErrorBox c={c} />
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton c={c} />
          {c.footerExtra?.(c.answers, c.pagesOrder[0]?.id)}
        </div>
      </div>
    </form>
  );
}

/* ---------------- Wizard ---------------- */

function WizardMode(c: Common & { onEvent?: FormRendererProps["onEvent"]; footerExtra?: FormRendererProps["footerExtra"]; initialPageId?: string; setErrors: (e: Record<string, string>) => void }) {
  const review = c.def.settings.reviewStep;
  const [rawStep, setStep] = useState(() => Math.max(0, c.pagesOrder.findIndex((p) => p.id === c.initialPageId)));
  const total = c.pagesOrder.length + (review ? 1 : 0);
  // Seiten können durch Logik verschwinden – Schritt begrenzen (abgeleitet, kein Effekt)
  const step = Math.min(rawStep, total - 1);
  const atReview = review && step >= c.pagesOrder.length;
  const page = c.pagesOrder[Math.min(step, c.pagesOrder.length - 1)];
  const top = useRef<HTMLDivElement>(null);

  function go(n: number) {
    setStep(n);
    const p = c.pagesOrder[n];
    if (p) c.onEvent?.("page", p.id);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function next() {
    const r = validateSubmission(c.def, c.answers, { onlyPages: [page.id] });
    if (!r.ok) {
      c.setErrors(r.errors);
      focusFirstError(r.errors);
      return;
    }
    c.setErrors({});
    if (step < total - 1) go(step + 1);
    else void submit();
  }

  async function submit() {
    const r = await c.doSubmit();
    if (!r.ok && r.errors) {
      const firstId = Object.keys(r.errors)[0]?.split(".")[0];
      const pi = c.pagesOrder.findIndex((p) => p.fields.some((f) => f.id === firstId));
      if (pi >= 0) go(pi);
      focusFirstError(r.errors);
    }
  }

  // Leere Seitentitel bleiben leer – „Schritt 1 von 4“ statt „Schritt 1 von 4: Schritt 1“
  const named = [...c.pagesOrder.map((p) => c.text(p.title)), ...(review ? ["Überprüfen"] : [])];
  const titles = named.map((t, i) => t || `Schritt ${i + 1}`);

  return (
    <div ref={top} className="scroll-mt-6">
      <Header def={c.def} text={c.text} compact preview={c.preview} />
      {c.def.settings.showProgress && total > 1 && (
        <nav aria-label="Fortschritt" className="mb-8">
          <ol className="flex gap-1.5">
            {titles.map((t, i) => (
              <li key={i} className="min-w-0 flex-1">
                <button type="button" disabled={i > step || c.submitting} onClick={() => go(i)} aria-label={`Schritt ${i + 1} von ${titles.length}: ${t}${i < step ? " (erledigt, zurückspringen)" : ""}`} className="group block min-h-11 w-full py-3.5 text-left disabled:cursor-default sm:min-h-0 sm:py-0" aria-current={i === step ? "step" : undefined}>
                  <span className={cn("block h-1 rounded-full transition-colors duration-300", i < step ? "bg-[var(--f-accent)]" : i === step ? "bg-[var(--f-accent)]" : "bg-[var(--f-line)]")} />
                  <span className={cn("mt-2 hidden truncate text-[12.5px] sm:block", i === step ? "font-medium text-[var(--f-ink)]" : "text-[var(--f-muted)] group-enabled:group-hover:text-[var(--f-ink)]")}>{t}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12.5px] text-[var(--f-muted)] sm:hidden">
            Schritt {step + 1} von {total}
            {named[step] ? `: ${named[step]}` : ""}
          </p>
        </nav>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (atReview) void submit();
          else next();
        }}
      >
        <div key={atReview ? "review" : page.id} className="animate-rise">
          {atReview ? (
            <ReviewList c={c} onEdit={(i) => go(i)} />
          ) : (
            <section className="space-y-7">
              {page.title && (
                <div>
                  <h2 className="font-[family-name:var(--f-display)] text-[24px] font-[450] tracking-[-0.01em]">{c.text(page.title)}</h2>
                  {page.description && <p className="mt-1.5 whitespace-pre-line text-[14.5px] text-[var(--f-muted)]">{c.text(page.description)}</p>}
                </div>
              )}
              <FieldGrid fields={page.fields} c={c} />
            </section>
          )}
        </div>
        <div className="mt-10 space-y-4">
          <FormErrorBox c={c} />
          <div className="flex flex-wrap items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} disabled={c.submitting} className="inline-flex h-12 items-center gap-2 rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)] px-5 text-[15px] font-medium text-[var(--f-ink-2)] hover:border-[var(--f-line-strong)]">
                <ArrowLeft className="size-4" /> Zurück
              </button>
            )}
            <SubmitButton c={c} label={step < total - 1 ? "Weiter" : c.def.settings.submitLabel} icon={step < total - 1 ? <ArrowRight className="size-4" /> : undefined} />
            {c.footerExtra?.(c.answers, page?.id)}
          </div>
        </div>
      </form>
    </div>
  );
}

function ReviewList({ c, onEdit }: { c: Common; onEdit: (pageIndex: number) => void }) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--f-display)] text-[24px] font-[450] tracking-[-0.01em]">Alles richtig?</h2>
        <p className="mt-1.5 text-[14.5px] text-[var(--f-muted)]">Bitte prüfen Sie Ihre Angaben, bevor Sie sie absenden.</p>
      </div>
      {c.pagesOrder.map((p, i) => {
        const rows = p.fields.filter((f) => isInputField(f) && f.type !== "hidden" && c.state.visible.has(f.id));
        if (!rows.length) return null;
        return (
          <div key={p.id} className="rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)]">
            <div className="flex items-center justify-between border-b border-[var(--f-line)] px-4 py-2.5">
              <h3 className="text-[14px] font-semibold">{c.text(p.title) || `Schritt ${i + 1}`}</h3>
              <button type="button" onClick={() => onEdit(i)} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[var(--f-accent)] hover:bg-[var(--f-tint)]">
                <Pencil className="size-3.5" /> Ändern
              </button>
            </div>
            <dl className="divide-y divide-[var(--f-line)]">
              {rows.map((f) => {
                const v = f.type === "calculated" ? c.state.computed[f.id] : c.answers[f.id];
                const shown = isEmpty(v) ? "" : formatValue(f, f.type === "number" || f.type === "currency" ? checkField(f, v, false).value : v);
                return (
                  <div key={f.id} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                    <dt className="text-[13.5px] text-[var(--f-muted)]">{c.text(f.label)}</dt>
                    <dd className={cn("text-[14.5px] break-words", !shown && "text-[var(--f-faint)]")}>{shown || "–"}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- Cards ---------------- */

function CardsMode(c: Common & { onEvent?: FormRendererProps["onEvent"]; footerExtra?: FormRendererProps["footerExtra"]; initialPageId?: string }) {
  // Jede sichtbare Frage (und jeder Infoblock) ist eine Karte.
  const cards = useMemo(
    () => c.pagesOrder.flatMap((p) => p.fields.filter((f) => c.state.visible.has(f.id) && f.type !== "hidden" && f.type !== "divider")),
    [c.pagesOrder, c.state.visible],
  );
  // Fortsetzungslink: bei der ersten Karte der gespeicherten Seite einsteigen
  const [rawI, setI] = useState(() => Math.max(0, cards.findIndex((f) => c.index.get(f.id)?.page.id === c.initialPageId)));
  const i = Math.min(rawI, cards.length);
  const [dir, setDir] = useState<1 | -1>(1);
  const atEnd = i >= cards.length;
  const card = cards[Math.min(i, cards.length - 1)];

  const go = useCallback(
    (n: number) => {
      setDir(n > i ? 1 : -1);
      setI(Math.max(0, Math.min(n, cards.length)));
      const f = cards[n];
      if (f) c.onEvent?.("page", c.index.get(f.id)?.page.id);
    },
    [i, cards, c],
  );

  const next = useCallback(() => {
    if (atEnd) return;
    if (isInputField(card)) {
      let err: string | undefined;
      if (card.type === "group") {
        const r = validateSubmission(c.def, c.answers, { onlyPages: [c.index.get(card.id)!.page.id] });
        err = Object.entries(r.errors).find(([k]) => k === card.id || k.startsWith(`${card.id}.`))?.[1];
      } else if (card.type !== "calculated") {
        err = checkField(card, c.answers[card.id], c.state.required.has(card.id), c.def.settings.language).error;
      }
      if (err) {
        setLocalErr({ [card.id]: err });
        return;
      }
    }
    setLocalErr({});
    go(i + 1);
  }, [atEnd, card, c, go, i]);

  const [localErr, setLocalErr] = useState<Record<string, string>>({});
  // Verzögerte Aufrufe (Klick/Buchstabe → weiter) sollen den aktuellen Antwortstand sehen
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });
  const advance = useCallback(() => nextRef.current(), []);
  const errs = { ...c.errors, ...localErr };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "ArrowUp" && e.altKey) {
        e.preventDefault();
        go(i - 1);
      } else if (e.key === "ArrowDown" && e.altKey) {
        e.preventDefault();
        next();
      } else if (e.key === "Enter" && !e.shiftKey && t.tagName !== "TEXTAREA" && t.tagName !== "BUTTON" && !(t.tagName === "INPUT")) {
        e.preventDefault();
        if (atEnd) void submit();
        else next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function submit() {
    const r = await c.doSubmit();
    if (!r.ok && r.errors) {
      const firstId = Object.keys(r.errors)[0]?.split(".")[0];
      const idx = cards.findIndex((f) => f.id === firstId);
      if (idx >= 0) go(idx);
    }
  }

  const progress = cards.length ? Math.min(i, cards.length) / cards.length : 0;
  const cc = { ...c, errors: errs };

  return (
    <div className="flex min-h-[min(560px,70dvh)] flex-col">
      {c.def.settings.showProgress && (
        <div className="mb-10 h-1 overflow-hidden rounded-full bg-[var(--f-line)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Fortschritt">
          <div className="h-full rounded-full bg-[var(--f-accent)] transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center">
        <div key={atEnd ? "end" : card?.id} className={cn(dir === 1 ? "animate-[card-in_340ms_var(--ease-out-soft)]" : "animate-[card-back_340ms_var(--ease-out-soft)]")}>
          {i === 0 && <Header def={c.def} text={c.text} compact preview={c.preview} />}
          {atEnd || !card ? (
            <div className="space-y-6">
              <h2 className="font-[family-name:var(--f-display)] text-[clamp(24px,4vw,32px)] font-[450] leading-tight">Bereit zum Absenden?</h2>
              <p className="text-[16px] text-[var(--f-muted)]">Mit dem Pfeil nach oben können Sie jede Antwort noch einmal prüfen.</p>
              <FormErrorBox c={cc} />
              <SubmitButton c={cc} onClick={() => void submit()} icon={<Check className="size-4" />} />
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                {isInputField(card) && (
                  <div className="mb-2 inline-flex items-center gap-1 font-mono text-[13px] text-[var(--f-accent)]" aria-hidden>
                    {cards.filter(isInputField).indexOf(card) + 1}
                    <ArrowRight className="size-3" />
                  </div>
                )}
                <RenderField field={card} c={cc} large autoFocus onEnter={advance} />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={next} className="inline-flex h-11 items-center gap-2 rounded-[var(--f-radius)] bg-[var(--f-accent)] px-5 text-[15px] font-semibold text-[var(--f-accent-ink)] hover:brightness-110 active:scale-[0.98]">
                  {isInputField(card) ? "OK" : "Weiter"} <Check className="size-4" />
                </button>
                <span className="hidden items-center gap-1 text-[12.5px] text-[var(--f-muted)] sm:inline-flex">
                  oder <kbd className="inline-flex items-center gap-0.5 rounded border border-[var(--f-line)] px-1.5 py-0.5 font-mono text-[11px]">Enter <CornerDownLeft className="size-3" /></kbd>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-10 flex items-center justify-end gap-1">
        {c.footerExtra && <div className="mr-auto">{c.footerExtra(c.answers, card ? (c.index.get(card.id)?.page.id ?? c.pagesOrder[0]?.id) : c.pagesOrder[0]?.id)}</div>}
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Vorherige Frage" className="grid size-10 place-items-center rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)] text-[var(--f-ink-2)] hover:border-[var(--f-line-strong)] disabled:opacity-40">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" onClick={next} disabled={atEnd} aria-label="Nächste Frage" className="grid size-10 place-items-center rounded-[var(--f-radius)] border border-[var(--f-line)] bg-[var(--f-field)] text-[var(--f-ink-2)] hover:border-[var(--f-line-strong)] disabled:opacity-40">
          <ArrowDown className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Abschluss ---------------- */

function EndingView({ ending, text, preview }: { ending: Ending; text: (s: string) => string; preview?: boolean }) {
  return (
    <div className="py-10 text-center animate-rise" role="status">
      <div className="mx-auto mb-6 grid size-14 place-items-center rounded-full bg-[var(--f-accent-soft)] text-[var(--f-accent)]">
        <Check className="size-7" strokeWidth={2.5} />
      </div>
      <h1 className="font-[family-name:var(--f-display)] text-[clamp(26px,5vw,34px)] font-[450] leading-tight tracking-[-0.01em]">{text(ending.title)}</h1>
      {ending.body && <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-[16px] leading-relaxed text-[var(--f-muted)]">{text(ending.body)}</p>}
      {preview && <p className="mx-auto mt-8 inline-block rounded-full bg-[var(--f-tint)] px-3 py-1 text-[12.5px] text-[var(--f-muted)]">Vorschau – es wurde nichts gespeichert.</p>}
    </div>
  );
}
