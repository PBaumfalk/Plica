"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Clock, Copy, Download, ExternalLink, FileText, Loader2, MoreHorizontal, PenLine, ShieldAlert, ShieldCheck, Tag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useCommands } from "@/components/app/command-palette";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, Kbd, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip } from "@/components/ui/overlays";
import { FollowUpButton } from "@/components/share/follow-up-button";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/time";
import { addNoteAction, changeTagsAction, deleteNoteAction, deleteSubmissionsAction, releaseFileAction, setStarredAction, setSubmissionStatusAction } from "@/server/actions/submissions";
import { primaryText, StarButton } from "./responses-view";
import { STATUS_META, STATUS_ORDER, StatusMenu } from "./status";
import type { DetailData, DetailFile, DetailItem, ResponsesData, Status } from "./types";
import { qs } from "./use-query";

export function ResponseSplit({ data, detail }: { data: ResponsesData; detail: DetailData }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [detail.id]);
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="hidden self-start overflow-hidden rounded-lg bg-paper shadow-sheet lg:block" aria-label="Antwortliste">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[12.5px] text-muted">
          <Link href={`/formulare/${data.form.id}/antworten${qs(data.query)}`} className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" /> Tabelle
          </Link>
          <span className="tabular">{data.total} Antworten</span>
        </div>
        <ul ref={listRef} className="max-h-[calc(100dvh-260px)] overflow-y-auto">
          {data.rows.map((r) => {
            const on = r.id === detail.id;
            return (
              <li key={r.id}>
                <Link
                  href={`/formulare/${data.form.id}/antworten/${r.id}${qs(data.query)}`}
                  aria-current={on}
                  scroll={false}
                  className={cn("block border-b border-line px-3 py-2.5 transition-colors", on ? "bg-stamp-soft/70" : "hover:bg-paper-2")}
                >
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span className="font-mono">#{r.number}</span>
                    <span className={cn("size-1.5 rounded-full", STATUS_META[r.status].dot)} aria-label={STATUS_META[r.status].label} />
                    {r.starred && <span className="text-warn">★</span>}
                    <span className="ml-auto"><TimeAgo at={r.submittedAt} /></span>
                  </div>
                  <div className={cn("mt-0.5 truncate text-[13.5px]", r.status === "new" ? "font-semibold" : "font-medium text-ink-2")}>{primaryText(r, data.columns)}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
      <ResponseDetail data={data} d={detail} />
    </div>
  );
}

function ResponseDetail({ data, d }: { data: ResponsesData; d: DetailData }) {
  const router = useRouter();
  const [view, setView] = useState<"data" | "pdf">("data");
  const [, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/formulare/${data.form.id}/antworten`;
  const go = (id: string | null) => id && router.push(`${base}/${id}${qs(data.query)}`, { scroll: false });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast(msg);
      after?.();
      router.refresh();
    });

  const setStatus = (s: Status) => s !== d.status && run(() => setSubmissionStatusAction(data.form.id, [d.id], s), `Status: ${STATUS_META[s].label}`);

  // j/k Nachbarn, 1–6 Status, p PDF, Esc zurück zur Tabelle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        go(d.next);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        go(d.prev);
      }
      else if (e.key === "p") setView((v) => (v === "pdf" ? "data" : "pdf"));
      else if (e.key === "Escape") router.push(`${base}${qs(data.query)}`);
      else if (data.can.update && /^[1-6]$/.test(e.key)) setStatus(STATUS_ORDER[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useCommands("response-detail", [
    { id: "resp-pdf", label: view === "pdf" ? "Antwortdaten zeigen" : "Als PDF ansehen", group: `Antwort #${d.number}`, icon: <FileText />, shortcut: "P", run: () => setView(view === "pdf" ? "data" : "pdf") },
    { id: "resp-download", label: "PDF herunterladen", group: `Antwort #${d.number}`, icon: <Download />, run: () => download(`/api/submissions/${d.id}/pdf`) },
    ...(data.can.update ? STATUS_ORDER.map((s, i) => ({ id: `resp-status-${s}`, label: `Status: ${STATUS_META[s].label}`, group: `Antwort #${d.number}`, shortcut: String(i + 1), run: () => setStatus(s) })) : []),
  ]);

  return (
    <article className="min-w-0 rounded-lg bg-paper shadow-sheet" aria-labelledby="resp-title">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
        <Link href={`${base}${qs(data.query)}`} className="-ml-1 rounded-sm p-1 text-muted hover:text-ink lg:hidden" aria-label="Zurück zur Liste">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 id="resp-title" className="font-display text-[22px] font-[450] tracking-[-0.01em]">
          Antwort <span className="tabular">#{d.number}</span>
        </h2>
        <StatusMenu status={d.status} onChange={setStatus} disabled={!data.can.update} />
        <StarButton starred={d.starred} disabled={!data.can.update} onToggle={() => run(() => setStarredAction(data.form.id, [d.id], !d.starred), d.starred ? "Markierung entfernt" : "Markiert")} />
        <div className="ml-auto flex items-center gap-1.5">
          <FollowUpButton submissionId={d.id} formId={data.form.id} />
          <Segmented label="Ansicht" size="sm" value={view} onChange={setView} options={[{ value: "data", label: "Daten" }, { value: "pdf", label: "PDF", title: "Taste P" }]} />
          <Tip label="Vorherige" shortcut="K">
            <Button size="icon-sm" variant="ghost" aria-label="Vorherige Antwort" disabled={!d.prev} onClick={() => go(d.prev)}>
              <ChevronUp />
            </Button>
          </Tip>
          <Tip label="Nächste" shortcut="J">
            <Button size="icon-sm" variant="ghost" aria-label="Nächste Antwort" disabled={!d.next} onClick={() => go(d.next)}>
              <ChevronDown />
            </Button>
          </Tip>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Weitere Aktionen">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem asChild>
                <a href={`/api/submissions/${d.id}/pdf`} download>
                  <Download /> PDF herunterladen
                </a>
              </MenuItem>
              <MenuItem onSelect={() => navigator.clipboard.writeText(d.id).then(() => toast("Antwort-ID kopiert"))}>
                <Copy /> Antwort-ID kopieren
              </MenuItem>
              {data.can.delete && (
                <>
                  <MenuSeparator />
                  <MenuItem danger onSelect={() => setConfirmDelete(true)}>
                    <Trash2 /> Endgültig löschen …
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
        <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <span title={dateTime(d.submittedAt)}>
            <Clock className="mr-1 inline size-3.5 -translate-y-px" />
            {dateTime(d.submittedAt)}
          </span>
          <span>Version {d.version}</span>
          {d.meta.durationMs ? <span>Ausfülldauer {formatDuration(d.meta.durationMs)}</span> : null}
          {d.meta.embedded && <span>über eingebettetes Formular</span>}
          {d.endingTitle && <span>Abschluss: {d.endingTitle}</span>}
          {d.deleteAfter && <span>wird am {new Date(d.deleteAfter).toLocaleDateString("de-DE")} gelöscht</span>}
        </div>
      </header>

      {view === "pdf" ? (
        <PdfPane id={d.id} />
      ) : (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 px-4 py-5 sm:px-6">
            {d.sections.length === 0 && <p className="text-[13.5px] text-muted">Diese Antwort enthält keine ausgefüllten Felder.</p>}
            {d.sections.map((s, i) => (
              <section key={i} className="mb-6 last:mb-0">
                {s.title && <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{s.title}</h3>}
                <dl className="divide-y divide-line">
                  {s.items.map((it) => (
                    <div key={it.fieldId} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-5">
                      <dt className="text-[13px] text-muted">{it.label}</dt>
                      <dd className="min-w-0 text-[14px] break-words">
                        <Value item={it} canRelease={data.can.release} onReleased={() => router.refresh()} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <aside className="space-y-6 border-t border-line px-4 py-5 sm:px-6 xl:border-l xl:border-t-0">
            <Tags d={d} data={data} run={run} />
            <Notes d={d} data={data} />
            <Timeline items={d.timeline} />
          </aside>
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={`Antwort #${d.number} endgültig löschen?`} description="Die Antwort, alle Dateien und Unterschriften werden unwiderruflich entfernt. Der Vorgang wird im Audit-Log festgehalten.">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => (setConfirmDelete(false), run(() => deleteSubmissionsAction(data.form.id, [d.id]), "Antwort gelöscht", () => router.push(d.next || d.prev ? `${base}/${d.next ?? d.prev}${qs(data.query)}` : `${base}${qs(data.query)}`)))}>
              Endgültig löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

/** Datei-Download über einen echten Link (API-Route, keine Seite). */
function download(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  a.click();
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

function fmtSize(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function Value({ item, canRelease, onReleased }: { item: DetailItem; canRelease: boolean; onReleased: () => void }) {
  if (item.files) return <Files files={item.files} canRelease={canRelease} onReleased={onReleased} />;
  if (item.signature !== undefined) {
    const s = item.signature;
    if (!s) return <span className="text-faint">–</span>;
    return (
      <figure className="overflow-hidden rounded-md border border-line">
        {/* Unterschriften sind schwarz auf transparent – immer auf hellem Grund zeigen */}
        <div className="bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${s.fileId}?inline=1`} alt={`Unterschrift: ${item.label}`} className="h-20 w-auto max-w-full object-contain" />
        </div>
        <figcaption className="space-y-0.5 border-t border-line bg-paper-2 px-3 py-2 text-[11.5px] text-muted">
          <div className="flex items-center gap-1.5 font-medium text-ink-2">
            <PenLine className="size-3.5" /> Einfache elektronische Signatur
          </div>
          {s.signedAt && <div>Unterschrieben am {dateTime(s.signedAt)}</div>}
          <div className="break-all font-mono text-[10.5px]">SHA-256 {s.hash}</div>
          {s.userAgent && <div className="line-clamp-1" title={s.userAgent}>Gerät: {s.userAgent}</div>}
        </figcaption>
      </figure>
    );
  }
  if (item.group)
    return (
      <div className="space-y-2">
        {item.group.map((g, i) => (
          <div key={i} className="rounded-md bg-paper-2 px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.title}</div>
            {g.rows.map((r, j) => (
              <div key={j} className="text-[13.5px]">
                <span className="text-muted">{r.label}:</span> {r.value}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  if (item.lines) return <ul className="space-y-0.5">{item.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  if (item.type === "long_text") return <p className="whitespace-pre-line leading-relaxed">{item.text}</p>;
  if (item.type === "email") return <a className="text-stamp hover:underline" href={`mailto:${item.text}`}>{item.text}</a>;
  if (item.type === "phone") return <a className="text-stamp hover:underline" href={`tel:${item.text.replace(/[^\d+]/g, "")}`}>{item.text}</a>;
  return <span className={cn(item.type === "calculated" && "font-mono tabular")}>{item.text}</span>;
}

function Files({ files, canRelease, onReleased }: { files: DetailFile[]; canRelease: boolean; onReleased: () => void }) {
  const [pending, start] = useTransition();
  return (
    <ul className="space-y-2">
      {files.map((f) => {
        const ok = f.status === "clean" || f.released;
        const isImage = f.mime.startsWith("image/");
        return (
          <li key={f.id} className="overflow-hidden rounded-md border border-line">
            {ok && isImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${f.id}?inline=1`} alt={f.name} className="max-h-56 w-full bg-paper-2 object-contain" />
            )}
            <div className="flex items-center gap-2.5 px-3 py-2">
              {f.status === "infected" ? <ShieldAlert className="size-4 shrink-0 text-bad" /> : ok ? <FileText className="size-4 shrink-0 text-muted" /> : <AlertTriangle className="size-4 shrink-0 text-warn" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px]">{f.name}</div>
                <div className="text-[11.5px] text-muted">
                  {fmtSize(f.size)} · {f.status === "clean" ? (<><ShieldCheck className="inline size-3 -translate-y-px text-ok" /> virengeprüft</>) : f.status === "infected" ? "gesperrt: Schadsoftware erkannt" : f.released ? "ohne Virenprüfung freigegeben" : "Quarantäne – nicht auf Viren geprüft"}
                </div>
              </div>
              {ok && f.mime === "application/pdf" && (
                <Button asChild size="sm" variant="ghost">
                  <a href={`/api/files/${f.id}?inline=1`} target="_blank" rel="noopener"><ExternalLink /> Öffnen</a>
                </Button>
              )}
              {ok && (
                <Button asChild size="sm" variant="secondary">
                  <a href={`/api/files/${f.id}`} download><Download /> Laden</a>
                </Button>
              )}
              {!ok && f.status !== "infected" && canRelease && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await releaseFileAction(f.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast("Datei freigegeben");
                      onReleased();
                    })
                  }
                >
                  Freigeben
                </Button>
              )}
            </div>
            {!ok && f.status !== "infected" && (
              <p className="border-t border-line bg-warn-soft px-3 py-2 text-[12px] text-warn">
                Es ist kein Virenscanner eingerichtet. Öffne die Datei nur, wenn du dem Absender vertraust.{!canRelease && " Freigeben kann eine Person mit Bearbeiterrechten."}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PdfPane({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setError(null);
    fetch(`/api/submissions/${id}/pdf?inline=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message ?? "Das PDF konnte nicht erzeugt werden.");
        return r.blob();
      })
      .then((b) => {
        if (cancelled) return;
        revoked = URL.createObjectURL(b);
        setUrl(revoked);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);
  return (
    <div className="bg-desk-2 p-3 sm:p-4">
      {error ? (
        <p className="py-16 text-center text-[13.5px] text-bad">{error}</p>
      ) : url ? (
        <iframe src={url} title="PDF-Ansicht der Antwort" className="h-[75dvh] w-full rounded-md border border-line bg-white" />
      ) : (
        <div className="flex h-[75dvh] items-center justify-center gap-2 text-[13.5px] text-muted">
          <Loader2 className="size-4 animate-spin" /> PDF wird erzeugt …
        </div>
      )}
    </div>
  );
}

function Tags({ d, data, run }: { d: DetailData; data: ResponsesData; run: (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <section aria-labelledby="tags-h">
      <h3 id="tags-h" className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-faint">
        <Tag className="size-3.5" /> Tags
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {d.tags.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-xs bg-desk-2 pl-2 pr-1 text-[12.5px]">
            {t}
            {data.can.update && (
              <button aria-label={`Tag ${t} entfernen`} onClick={() => run(() => changeTagsAction(data.form.id, [d.id], [], [t]), `Tag „${t}“ entfernt`)} className="rounded-xs p-0.5 text-faint hover:text-ink">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!d.tags.length && !data.can.update && <span className="text-[13px] text-faint">Keine Tags</span>}
      </div>
      {data.can.update && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = value.trim();
            if (!t) return;
            setValue("");
            run(() => changeTagsAction(data.form.id, [d.id], [t], []), `Tag „${t}“ hinzugefügt`);
          }}
        >
          <input list="detail-tags" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tag hinzufügen …" aria-label="Tag hinzufügen" className="h-7 w-full rounded-sm border border-transparent bg-transparent px-1.5 text-[13px] placeholder:text-faint hover:border-line focus:border-stamp focus:bg-paper focus:outline-none" />
          <datalist id="detail-tags">{data.tags.filter((t) => !d.tags.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
        </form>
      )}
    </section>
  );
}

function Notes({ d, data }: { d: DetailData; data: ResponsesData }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await addNoteAction(data.form.id, d.id, body);
      if (!r.ok) return void toast.error(r.error);
      setBody("");
      router.refresh();
    });
  return (
    <section aria-labelledby="notes-h">
      <h3 id="notes-h" className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Interne Notizen</h3>
      <ul className="space-y-2">
        {d.notes.map((n) => (
          <li key={n.id} className="group rounded-md bg-warn-soft/60 px-3 py-2">
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <span className="font-medium text-ink-2">{n.user ?? "Gelöschtes Konto"}</span>
              <span title={dateTime(n.createdAt)}><TimeAgo at={n.createdAt} /></span>
              {(n.mine || data.can.delete) && data.can.update && (
                <button
                  className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-bad"
                  aria-label="Notiz löschen"
                  onClick={() =>
                    start(async () => {
                      const r = await deleteNoteAction(data.form.id, n.id);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-line text-[13.5px]">{n.body}</p>
          </li>
        ))}
      </ul>
      {data.can.update ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) save();
            }}
            placeholder="Notiz für das Team – nur intern sichtbar"
            aria-label="Neue Notiz"
            className="min-h-16 text-[13.5px]"
          />
          {body.trim() && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-[11.5px] text-faint">
                <Kbd>⌘</Kbd> <Kbd>↵</Kbd>
              </span>
              <Button size="sm" variant="primary" loading={pending} onClick={save}>Notiz speichern</Button>
            </div>
          )}
        </div>
      ) : (
        !d.notes.length && <p className="text-[13px] text-faint">Keine Notizen.</p>
      )}
    </section>
  );
}

function Timeline({ items }: { items: DetailData["timeline"] }) {
  return (
    <section aria-labelledby="hist-h">
      <h3 id="hist-h" className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Verlauf</h3>
      <ol className="relative space-y-3 border-l border-line pl-4">
        {items.map((t) => (
          <li key={t.id} className="relative text-[12.5px]">
            <span className={cn("absolute -left-[20.5px] top-1.5 size-2 rounded-full border-2 border-paper", t.tone === "bad" ? "bg-bad" : t.tone === "ok" ? "bg-ok" : t.kind === "run" ? "bg-stamp" : "bg-line-strong")} />
            <div className="text-ink-2">{t.text}</div>
            <div className="text-[11.5px] text-faint">
              {t.who ? `${t.who} · ` : ""}
              <span title={dateTime(t.at)}><TimeAgo at={t.at} /></span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
