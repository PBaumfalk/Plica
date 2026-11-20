"use client";
import { Archive, Download, ExternalLink, Globe, Lock, Pause, Play, QrCode, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { FormRow, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/time";
import { publishAction, setStatusAction, updatePublishSettingsAction } from "@/server/actions/forms";
import { checkSlugAction } from "@/server/actions/share";
import { CodeBlock, CopyButton } from "./copy-field";

type FormInfo = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "paused" | "archived";
  hasPassword: boolean;
  opensAt: string | null;
  closesAt: string | null;
  maxSubmissions: number | null;
  submissionCount: number;
  notifyEmails: string[];
  retentionDays: number | null;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function Section({ title, description, children, icon }: { title: string; description?: ReactNode; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-7 last:border-b-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="flex items-center gap-2 text-[14.5px] font-semibold [&_svg]:size-4 [&_svg]:text-muted">{icon}{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

export function ShareView({ form, version, draftChanged, canPublish, publicUrl, embedOrigins }: { form: FormInfo; version: { number: number; publishedAt: string } | null; draftChanged: boolean; canPublish: boolean; publicUrl: string; embedOrigins: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const url = `${publicUrl}/f/${form.slug}`;
  const live = form.status === "published";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast(msg);
      router.refresh();
    });

  return (
    <div className="rounded-lg bg-paper px-5 shadow-sheet sm:px-8">
      {/* Status */}
      <Section title="Status" icon={<Globe />} description="Nur die veröffentlichte Version ist öffentlich. Änderungen im Editor bleiben Entwurf, bis du erneut veröffentlichst.">
        <div className="flex flex-wrap items-center gap-3">
          {form.status === "published" && <Badge tone="ok" dot>Nimmt Antworten an</Badge>}
          {form.status === "paused" && <Badge tone="warn" dot>Pausiert</Badge>}
          {form.status === "draft" && <Badge dot>{version ? "Nicht öffentlich" : "Noch nie veröffentlicht"}</Badge>}
          {form.status === "archived" && <Badge dot>Archiviert</Badge>}
          {version && <span className="text-[13px] text-muted">Version {version.number} · veröffentlicht {dateTime(version.publishedAt)}</span>}
        </div>
        {draftChanged && (
          <p className="rounded-md bg-stamp-soft px-3 py-2 text-[13px] text-stamp">Der Entwurf enthält Änderungen, die noch nicht veröffentlicht sind. Ausfüllende sehen weiterhin Version {version?.number}.</p>
        )}
        {canPublish && (
          <div className="flex flex-wrap gap-2">
            {(!version || draftChanged || form.status === "draft") && (
              <Button variant="primary" loading={pending} onClick={() => start(async () => {
                const r = await publishAction(form.id);
                if (!r.ok) return void toast.error(r.error);
                toast(`Version ${r.data.version} veröffentlicht`);
                router.refresh();
              })}>
                <Send /> {version ? "Änderungen veröffentlichen" : "Veröffentlichen"}
              </Button>
            )}
            {form.status === "published" && <Button onClick={() => run(() => setStatusAction(form.id, "paused"), "Formular pausiert")} disabled={pending}><Pause /> Pausieren</Button>}
            {form.status === "paused" && <Button onClick={() => run(() => setStatusAction(form.id, "published"), "Formular wieder geöffnet")} disabled={pending}><Play /> Wieder öffnen</Button>}
            {form.status !== "archived" && version && <Button variant="ghost" onClick={() => run(() => setStatusAction(form.id, "archived"), "Formular archiviert")} disabled={pending}><Archive /> Archivieren</Button>}
            {form.status === "archived" && <Button onClick={() => run(() => setStatusAction(form.id, "published"), "Formular wieder veröffentlicht")} disabled={pending}><Play /> Wieder veröffentlichen</Button>}
          </div>
        )}
      </Section>

      {/* Link */}
      <Section title="Link" description={live ? "Teile diesen Link per E-Mail, Messenger oder auf deiner Website." : "Der Link funktioniert, sobald das Formular veröffentlicht ist und Antworten annimmt."}>
        <div className="flex flex-wrap gap-2">
          <div className={cn("flex h-9 min-w-0 flex-1 items-center rounded-md border border-line bg-paper-2 px-3 font-mono text-[13px]", !live && "text-faint")}>
            <span className="truncate">{url}</span>
          </div>
          <CopyButton text={url} label="Link kopieren" variant="primary" />
          <Button asChild variant="secondary"><a href={url} target="_blank" rel="noopener"><ExternalLink /> Öffnen</a></Button>
        </div>
        {canPublish && <SlugEditor formId={form.id} slug={form.slug} publicUrl={publicUrl} />}
      </Section>

      {/* QR */}
      <Section title="QR-Code" icon={<QrCode />} description="Für Aushänge, Flyer und den Empfang. Schwarz auf Weiß mit Ruhezone – so bleibt der Code auch gedruckt zuverlässig lesbar.">
        <div className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/forms/${form.id}/qr?format=svg&v=${encodeURIComponent(form.slug)}`} alt={`QR-Code für ${url}`} width={148} height={148} className="rounded-md border border-line bg-white p-1" />
          <div className="space-y-2">
            <Button asChild variant="secondary"><a href={`/api/forms/${form.id}/qr?format=svg&download=1`} download><Download /> SVG für den Druck</a></Button>
            <Button asChild variant="secondary" className="ml-2"><a href={`/api/forms/${form.id}/qr?format=png&download=1`} download><Download /> PNG (1200 px)</a></Button>
            <p className="text-[12.5px] text-muted">Wenn du die Adresse änderst, ändert sich auch der QR-Code.</p>
          </div>
        </div>
      </Section>

      {/* Einbetten */}
      <EmbedSection url={url} publicUrl={publicUrl} title={form.title} embedOrigins={embedOrigins} />

      {/* Zugang */}
      <AccessSection form={form} disabled={!canPublish} />

      {/* Benachrichtigung & Aufbewahrung */}
      <NotifySection form={form} disabled={!canPublish} />
    </div>
  );
}

function SlugEditor({ formId, slug, publicUrl }: { formId: string; slug: string; publicUrl: string }) {
  const router = useRouter();
  const [value, setValue] = useState(slug);
  const [state, setState] = useState<{ checking: boolean; problem?: string; ok?: boolean }>({ checking: false });
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const changed = value !== slug;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function onSlugChange(raw: string) {
    const next = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").slice(0, 60);
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    if (next === slug) return setState({ checking: false });
    setState({ checking: true });
    timer.current = setTimeout(async () => {
      const r = await checkSlugAction(formId, next);
      if (!r.ok) return setState({ checking: false, problem: r.error });
      setState({ checking: false, ok: r.data.available, problem: r.data.problem });
    }, 350);
  }

  const save = () =>
    start(async () => {
      const r = await updatePublishSettingsAction(formId, { slug: value });
      if (!r.ok) return void toast.error(r.error);
      toast("Adresse geändert");
      setConfirm(false);
      router.refresh();
    });

  return (
    <div className="space-y-1.5">
      <label htmlFor="slug" className="block text-[13px] font-medium text-ink-2">Adresse anpassen</label>
      <div className="flex flex-wrap gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-line-strong bg-paper focus-within:border-stamp focus-within:ring-3 focus-within:ring-stamp/15">
          <span className="truncate pl-3 font-mono text-[13px] text-faint max-sm:hidden">{publicUrl.replace(/^https?:\/\//, "")}/f/</span>
          <input id="slug" value={value} onChange={(e) => onSlugChange(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent px-1 font-mono text-[13px] outline-none max-sm:pl-3" aria-invalid={!!state.problem} aria-describedby="slug-hint" spellCheck={false} />
        </div>
        <Button onClick={() => setConfirm(true)} disabled={!changed || !state.ok || state.checking || pending}>Speichern</Button>
      </div>
      <p id="slug-hint" className={cn("text-[12.5px]", state.problem ? "text-bad" : state.ok ? "text-ok" : "text-muted")} aria-live="polite">
        {!changed ? "Kleinbuchstaben, Ziffern und Bindestriche." : state.checking ? "Wird geprüft …" : state.problem ?? (state.ok ? "Diese Adresse ist frei." : "")}
      </p>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Adresse ändern?" description={`Der bisherige Link /f/${slug} und bereits gedruckte QR-Codes funktionieren danach nicht mehr.`}>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Abbrechen</Button>
            <Button variant="primary" loading={pending} onClick={save}>Adresse ändern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmbedSection({ url, publicUrl, title, embedOrigins }: { url: string; publicUrl: string; title: string; embedOrigins: string }) {
  const [kind, setKind] = useState<"script" | "iframe">("script");
  const safeTitle = title.replace(/"/g, "&quot;");
  const script = `<div data-plica-form="${url}" data-plica-title="${safeTitle}"></div>\n<script src="${publicUrl}/embed.js" async></script>`;
  const iframe = `<iframe src="${url}?embed=1" title="${safeTitle}" width="100%" height="900" style="border:0" loading="lazy"></iframe>`;
  return (
    <Section title="In Website einbetten" description="Das Formular erscheint direkt in deiner Seite – ohne PLICA-Rahmen, passend zur Breite.">
      <Segmented label="Art der Einbettung" size="sm" value={kind} onChange={setKind} options={[{ value: "script", label: "Mit automatischer Höhe" }, { value: "iframe", label: "Nur iframe" }]} />
      {kind === "script" ? (
        <>
          <CodeBlock label="HTML" code={script} />
          <p className="text-[12.5px] text-muted">Das Skript passt die Höhe bei jedem Schritt an, damit nie doppelte Scrollbalken entstehen.</p>
        </>
      ) : (
        <>
          <CodeBlock label="HTML" code={iframe} />
          <p className="text-[12.5px] text-muted">Feste Höhe – wähle sie großzügig, besonders bei mehrstufigen Formularen.</p>
        </>
      )}
      <p className="text-[12.5px] text-muted">
        {embedOrigins === "*" ? "Einbettung ist auf allen Websites erlaubt." : <>Einbettung erlaubt auf: <span className="font-mono">{embedOrigins}</span></>} Festgelegt über <span className="font-mono">EMBED_ORIGINS</span> in der Serverkonfiguration.
      </p>
    </Section>
  );
}

function AccessSection({ form, disabled }: { form: FormInfo; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [opensAt, setOpensAt] = useState(toLocalInput(form.opensAt));
  const [closesAt, setClosesAt] = useState(toLocalInput(form.closesAt));
  const [limit, setLimit] = useState(form.maxSubmissions ? String(form.maxSubmissions) : "");
  const [error, setError] = useState<string | null>(null);

  const save = (patch: Parameters<typeof updatePublishSettingsAction>[1], msg: string) =>
    start(async () => {
      setError(null);
      const r = await updatePublishSettingsAction(form.id, patch);
      if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
      toast(msg);
      setPassword("");
      router.refresh();
    });

  const dateProblem = opensAt && closesAt && new Date(closesAt) <= new Date(opensAt) ? "Das Ende liegt vor dem Beginn." : null;
  const limitNum = limit ? Number(limit) : null;
  const limitProblem = limit && (!Number.isInteger(limitNum) || limitNum! < 1) ? "Bitte eine ganze Zahl ab 1." : null;

  return (
    <Section title="Zugang" icon={<Lock />} description="Wer das Formular wann und wie oft ausfüllen kann.">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[13.5px]">
          <span className="font-medium">Passwortschutz</span>
          {form.hasPassword ? <Badge tone="stamp">aktiv</Badge> : <span className="text-muted">aus</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="form-pw" className="sr-only">Neues Passwort</label>
          <Input id="form-pw" type="password" autoComplete="new-password" placeholder={form.hasPassword ? "Neues Passwort festlegen" : "Passwort festlegen"} value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-xs" disabled={disabled} />
          <Button disabled={disabled || password.length < 4 || pending} onClick={() => save({ password }, form.hasPassword ? "Passwort geändert" : "Passwortschutz aktiviert")}>{form.hasPassword ? "Ändern" : "Aktivieren"}</Button>
          {form.hasPassword && <Button variant="ghost" disabled={disabled || pending} onClick={() => save({ password: null }, "Passwortschutz entfernt")}><X /> Entfernen</Button>}
        </div>
        <p className="text-[12.5px] text-muted">Mindestens 4 Zeichen. Teile das Passwort getrennt vom Link.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Geöffnet ab" htmlFor="opens" hint="Leer = sofort">
          <Input id="opens" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} disabled={disabled} />
        </FormRow>
        <FormRow label="Antworten bis" htmlFor="closes" hint="Danach erscheint ein Hinweis statt des Formulars." error={dateProblem}>
          <Input id="closes" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} disabled={disabled} aria-invalid={!!dateProblem} />
        </FormRow>
        <FormRow label="Höchstens Antworten" htmlFor="limit" hint={`Bisher ${form.submissionCount}. Leer = unbegrenzt.`} error={limitProblem}>
          <Input id="limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} disabled={disabled} aria-invalid={!!limitProblem} />
        </FormRow>
      </div>
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      <Button
        disabled={disabled || pending || !!dateProblem || !!limitProblem}
        onClick={() => save({ opensAt: fromLocalInput(opensAt), closesAt: fromLocalInput(closesAt), maxSubmissions: limitNum }, "Zugang gespeichert")}
      >
        Zeitraum und Limit speichern
      </Button>
    </Section>
  );
}

function NotifySection({ form, disabled }: { form: FormInfo; disabled: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [emails, setEmails] = useState<string[]>(form.notifyEmails);
  const [draft, setDraft] = useState("");
  const [retention, setRetention] = useState(form.retentionDays ? String(form.retentionDays) : "");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const parts = draft.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = parts.find((p) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p));
    if (bad) return setError(`„${bad}“ ist keine gültige E-Mail-Adresse.`);
    setError(null);
    const next = [...new Set([...emails, ...parts])].slice(0, 20);
    setEmails(next);
    setDraft("");
    persist({ notifyEmails: next }, "Empfänger hinzugefügt");
  }

  // Sofort speichern – wie im Editor; kein separater Speichern-Knopf
  function persist(patch: { notifyEmails?: string[]; retentionDays?: number | null }, msg: string) {
    start(async () => {
      const r = await updatePublishSettingsAction(form.id, patch);
      if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
      setError(null);
      toast(msg);
      router.refresh();
    });
  }

  return (
    <Section title="Benachrichtigung und Aufbewahrung" description="Wer bei neuen Antworten eine E-Mail bekommt und wie lange Antworten gespeichert bleiben.">
      <div className="space-y-2">
        <label htmlFor="notify" className="block text-[13px] font-medium text-ink-2">E-Mail bei neuer Antwort an</label>
        {emails.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {emails.map((e) => (
              <li key={e} className="inline-flex h-7 items-center gap-1 rounded-full bg-desk-2 pl-3 pr-1 text-[13px]">
                {e}
                <button type="button" disabled={disabled} onClick={() => {
                  const next = emails.filter((x) => x !== e);
                  setEmails(next);
                  persist({ notifyEmails: next }, "Empfänger entfernt");
                }} aria-label={`${e} entfernen`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink">
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input id="notify" type="email" placeholder="name@firma.de" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} disabled={disabled} className="max-w-sm" />
          <Button onClick={add} disabled={disabled || !draft.trim()}>Hinzufügen</Button>
        </div>
        <p className="text-[12.5px] text-muted">Die E-Mail enthält eine Zusammenfassung und einen Link zur Antwort. Versand nur, wenn SMTP eingerichtet ist.</p>
      </div>
      <FormRow label="Antworten automatisch löschen nach" htmlFor="retention" hint="In Tagen. Leer = Standard des Workspace. Gilt für neue Antworten.">
        <div className="flex items-center gap-2">
          <Input
            id="retention"
            inputMode="numeric"
            value={retention}
            onChange={(e) => setRetention(e.target.value.replace(/\D/g, "").slice(0, 5))}
            onBlur={() => retention !== (form.retentionDays ? String(form.retentionDays) : "") && persist({ retentionDays: retention ? Number(retention) : null }, "Aufbewahrung gespeichert")}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            disabled={disabled}
            className="w-28"
          />
          <span className="text-[13px] text-muted">Tagen</span>
        </div>
      </FormRow>
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
    </Section>
  );
}
