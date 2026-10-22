"use client";
import { BarChart3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/ui/controls";
import { Empty } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import type { Analytics } from "@/server/analytics/service";
import { useRouter } from "next/navigation";

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)} %`);
const nf = new Intl.NumberFormat("de-DE");

function duration(ms: number | null) {
  if (ms === null) return "–";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} Sek.`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}:${String(s % 60).padStart(2, "0")} Min.` : `${Math.floor(m / 60)} Std. ${m % 60} Min.`;
}

export function AnalyticsView({ formId, data, published, versionNumber }: { formId: string; data: Analytics; published: boolean; versionNumber: number | null }) {
  const router = useRouter();
  const empty = data.views === 0 && data.submissions === 0;

  return (
    <div className="space-y-8 [--chart:#4636c9] dark:[--chart:#7a6df5]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Zeitraum"
          size="sm"
          value={String(data.days)}
          onChange={(v) => router.replace(`/formulare/${formId}/auswertung?tage=${v}`, { scroll: false })}
          options={[
            { value: "7", label: "7 Tage" },
            { value: "30", label: "30 Tage" },
            { value: "90", label: "90 Tage" },
            { value: "365", label: "1 Jahr" },
          ]}
        />
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <ShieldCheck className="size-3.5" /> Ohne Cookies, ohne IP-Adressen – nur anonyme Seitenaufrufe.
        </p>
      </div>

      {empty ? (
        <div className="rounded-lg bg-paper shadow-sheet">
          <Empty icon={<BarChart3 />} title={published ? "Noch keine Aufrufe in diesem Zeitraum" : "Noch nicht veröffentlicht"} action={!published ? <Link className="text-[13.5px] font-medium text-stamp hover:underline" href={`/formulare/${formId}/bearbeiten`}>Zum Editor</Link> : <Link className="text-[13.5px] font-medium text-stamp hover:underline" href={`/formulare/${formId}/teilen`}>Link teilen</Link>}>
            {published ? "Sobald jemand das Formular öffnet, siehst du hier, wie viele beginnen, wo sie abbrechen und wie lange das Ausfüllen dauert." : "Die Auswertung beginnt mit der ersten veröffentlichten Version."}
          </Empty>
        </div>
      ) : (
        <>
          <section aria-label="Kennzahlen" className="grid grid-cols-2 overflow-hidden rounded-lg bg-paper shadow-sheet md:grid-cols-4">
            {[
              { label: "Aufrufe", value: nf.format(data.views), note: "einzelne Seitenaufrufe" },
              { label: "Begonnen", value: nf.format(data.starts), note: `${pct(data.startRate)} der Aufrufe` },
              { label: "Abgesendet", value: nf.format(data.submissions), note: `${pct(data.completionRate)} der Begonnenen` },
              { label: "Typische Dauer", value: duration(data.medianMs), note: "Median bis zum Absenden" },
            ].map((s, i) => (
              <div key={s.label} className={cn("px-5 py-4", i % 2 === 1 && "border-l border-line", i >= 2 && "max-md:border-t md:border-l border-line")}>
                <div className="text-[12.5px] text-muted">{s.label}</div>
                <div className="mt-1 font-display text-[30px] leading-none font-[450] tabular">{s.value}</div>
                <div className="mt-1.5 text-[12px] text-faint">{s.note}</div>
              </div>
            ))}
          </section>

          <Funnel data={data} />
          <Daily daily={data.daily} />

          {data.distributions.length > 0 && (
            <section>
              <h2 className="mb-1 text-[15px] font-semibold">Antworten im Überblick</h2>
              <p className="mb-4 text-[13px] text-muted">Auswahlfelder {versionNumber ? `der veröffentlichten Version ${versionNumber}` : "des Entwurfs"}, Antworten im gewählten Zeitraum.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {data.distributions.map((d) => (
                  <Distribution key={d.fieldId} d={d} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Funnel({ data }: { data: Analytics }) {
  const max = Math.max(1, ...data.funnel.map((f) => f.count));
  let worst: { from: string; to: string; loss: number } | null = null;
  for (let i = 1; i < data.funnel.length; i++) {
    const a = data.funnel[i - 1];
    const b = data.funnel[i];
    if (a.count < 3) continue;
    const loss = 1 - b.count / a.count;
    if (loss > 0 && (!worst || loss > worst.loss)) worst = { from: a.label, to: b.label, loss };
  }
  return (
    <section className="rounded-lg bg-paper p-5 shadow-sheet sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">Wo Menschen aussteigen</h2>
          <p className="text-[13px] text-muted">{data.stepped ? "Wie viele Besuche jeden Schritt erreicht haben." : "Bei Classic-Formularen werden Aufruf, Beginn und Absenden gemessen."}</p>
        </div>
        {worst && worst.loss >= 0.15 && (
          <p className="rounded-md bg-warn-soft px-2.5 py-1 text-[12.5px] text-warn">
            Größter Abbruch: {worst.from} → {worst.to} (−{Math.round(worst.loss * 100)} %)
          </p>
        )}
      </div>
      <ol className="space-y-3 sm:space-y-2.5">
        {data.funnel.map((f, i) => {
          const prev = i > 0 ? data.funnel[i - 1].count : null;
          const share = prev ? f.count / prev : null;
          return (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem]">
              <span className="truncate text-[13.5px] text-ink-2" title={f.label}>{f.label}</span>
              <span className="col-span-2 row-start-2 h-3.5 rounded-[4px] bg-desk-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <span className="block h-full rounded-[4px] bg-[var(--chart)] transition-[width] duration-500" style={{ width: `${Math.max(f.count ? 1.5 : 0, (f.count / max) * 100)}%` }} />
              </span>
              <span className="text-right text-[13px] tabular sm:col-start-3 sm:row-start-1">
                <span className="font-medium text-ink">{nf.format(f.count)}</span>
                {share !== null && <span className="ml-1.5 text-muted">{pct(Math.min(1, share))}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Daily({ daily }: { daily: Analytics["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.count));
  const total = daily.reduce((s, d) => s + d.count, 0);
  const fmt = (iso: string, long = false) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", long ? { weekday: "short", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
  const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const h = 140;
  return (
    <section className="rounded-lg bg-paper p-5 shadow-sheet sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">Antworten pro Tag</h2>
          <p className="text-[13px] text-muted">{nf.format(total)} im Zeitraum</p>
        </div>
        <div aria-live="polite" className="text-right text-[13px] tabular">
          {hover !== null && daily[hover] && (
            <>
              <span className="font-semibold text-ink">{daily[hover].count}</span> <span className="text-muted">am {fmt(daily[hover].date, true)}</span>
            </>
          )}
        </div>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <div className="flex items-end gap-[2px] border-b border-line" style={{ height: h }} aria-hidden>
          {daily.map((d, i) => (
            <div key={d.date} className="flex h-full min-w-0 flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)}>
              <div
                className={cn("w-full rounded-t-[4px] transition-opacity", d.count ? "bg-[var(--chart)]" : "", hover !== null && hover !== i && "opacity-45")}
                style={{ height: d.count ? Math.max(3, (d.count / max) * (h - 8)) : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11.5px] text-faint tabular" aria-hidden>
          {ticks.map((t) => (
            <span key={t}>{daily[t] && fmt(daily[t].date)}</span>
          ))}
        </div>
        <div className="absolute right-0 top-0 -translate-y-1 text-[11px] text-faint tabular" aria-hidden>{max}</div>
      </div>
      <table className="sr-only">
        <caption>Antworten pro Tag</caption>
        <thead><tr><th>Datum</th><th>Antworten</th></tr></thead>
        <tbody>{daily.map((d) => <tr key={d.date}><td>{fmt(d.date, true)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Distribution({ d }: { d: Analytics["distributions"][number] }) {
  const max = Math.max(1, ...d.rows.map((r) => r.count));
  const multi = d.type === "checkboxes" || d.type === "multi_select";
  return (
    <div className="rounded-lg bg-paper p-5 shadow-sheet">
      <h3 className="text-[14px] font-medium leading-snug">{d.label}</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-muted">
        {d.total} {d.total === 1 ? "Antwort" : "Antworten"}
        {d.average !== undefined && ` · Durchschnitt ${d.average.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`}
        {multi && " · Mehrfachnennung möglich"}
      </p>
      {d.total === 0 ? (
        <p className="text-[13px] text-faint">Noch keine Antworten.</p>
      ) : (
        <ul className="space-y-1.5">
          {d.rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_3.5rem] items-center gap-2.5 text-[13px]" title={`${r.label}: ${r.count}`}>
              <span className="truncate text-ink-2">{r.label}</span>
              <span className="h-3.5 rounded-[3px] bg-desk-2">
                <span className="block h-full rounded-[3px] bg-[var(--chart)]" style={{ width: `${r.count ? Math.max(2, (r.count / max) * 100) : 0}%` }} />
              </span>
              <span className="text-right tabular">
                <span className="text-ink">{r.count}</span> <span className="text-faint">{Math.round((r.count / d.total) * 100)} %</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
