"use client";
import { Braces, Check, ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/forms/fields";
import { fieldIndex, isInputField, type Theme } from "@/lib/forms/schema";
import { useBuilder } from "./context";
import { insInput, NativeSelect, Row, Section, TextIn, Toggle } from "./inspector-ui";

/* ---------------- Abschlussseiten ---------------- */

export function EndingsPanel() {
  const { state, api } = useBuilder();
  const def = state.def;
  const keys = [...fieldIndex(def).values()].filter((e) => !e.parent && isInputField(e.field)).map((e) => e.field);
  const used = new Set(def.rules.flatMap((r) => r.actions.filter((a) => a.type === "set_ending").map((a) => a.target)));
  const edit = (id: string, patch: Partial<(typeof def.endings)[number]>, key?: string) =>
    api.mutate((d) => {
      const e = d.endings.find((x) => x.id === id);
      if (!e) return;
      Object.assign(e, patch);
      if (patch.redirectUrl === undefined && "redirectUrl" in patch) delete e.redirectUrl;
    }, key);

  return (
    <div className="space-y-3 p-3">
      <p className="px-1 text-[12.5px] leading-snug text-muted">Nach dem Absenden sehen Ausfüllende die Standard-Abschlussseite. Weitere Abschlussseiten wählst du über Regeln aus.</p>
      {def.endings.map((e, i) => {
        const badUrl = e.redirectUrl && !/^https?:\/\/[^\s]+$/i.test(e.redirectUrl);
        return (
          <div key={e.id} className="rounded-lg border border-line bg-paper p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">{i === 0 ? "Standard" : `Abschluss ${i + 1}`}{used.has(e.id) && <span className="ml-1.5 normal-case tracking-normal text-stamp">· per Regel</span>}</span>
              {i > 0 && (
                <button
                  type="button"
                  aria-label="Abschlussseite löschen"
                  onClick={() =>
                    api.mutate((d) => {
                      d.endings = d.endings.filter((x) => x.id !== e.id);
                      d.rules = d.rules.map((r) => ({ ...r, actions: r.actions.filter((a) => !(a.type === "set_ending" && a.target === e.id)) })).filter((r) => r.actions.length);
                    })
                  }
                  className="rounded-sm p-1 text-faint hover:bg-desk-2 hover:text-bad"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              <TextIn label="Überschrift" value={e.title} onChange={(t) => edit(e.id, { title: t }, `end-t:${e.id}`)} />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor={`end-b-${e.id}`} className="text-[12.5px] font-medium text-ink-2">Text</label>
                  <Menu>
                    <MenuTrigger className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12px] text-stamp hover:bg-stamp-soft" disabled={!keys.length}>
                      <Braces className="size-3.5" /> Antwort einsetzen
                    </MenuTrigger>
                    <MenuContent className="max-h-72 overflow-y-auto">
                      <MenuLabel>Wird durch die Antwort ersetzt</MenuLabel>
                      {keys.map((f) => (
                        <MenuItem key={f.id} onSelect={() => edit(e.id, { body: `${e.body}${e.body && !e.body.endsWith(" ") ? " " : ""}{{${f.key}}}` })}>
                          <span className="truncate">{f.label || f.key}</span>
                          <span className="ml-auto font-mono text-[11px] text-faint">{`{{${f.key}}}`}</span>
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </Menu>
                </div>
                <textarea id={`end-b-${e.id}`} rows={4} value={e.body} onChange={(ev) => edit(e.id, { body: ev.target.value }, `end-b:${e.id}`)} className={cn(insInput, "h-auto py-1.5 leading-relaxed")} placeholder="z. B. Danke, {{vorname}} – wir melden uns innerhalb von zwei Werktagen." />
              </div>
              <TextIn label="Weiterleitung (optional)" value={e.redirectUrl} onChange={(t) => edit(e.id, { redirectUrl: t.trim() || undefined }, `end-u:${e.id}`)} placeholder="https://www.beispiel.de/danke" error={badUrl ? "Muss mit http:// oder https:// beginnen." : null} hint="Statt der Seite direkt zu einer anderen Adresse weiterleiten." />
            </div>
          </div>
        );
      })}
      <Button size="sm" className="w-full justify-center" onClick={() => api.mutate((d) => void d.endings.push({ id: newId("e_"), title: "Vielen Dank!", body: "" }))}>
        <Plus /> Weitere Abschlussseite
      </Button>
    </div>
  );
}

/* ---------------- Design ---------------- */

const ACCENTS = [
  { hex: "#4636c9", name: "Stempel" },
  { hex: "#3b5bdb", name: "Kobalt" },
  { hex: "#1f5fbf", name: "Tinte" },
  { hex: "#0d7a5c", name: "Prüfgrün" },
  { hex: "#b4232a", name: "Siegel" },
  { hex: "#a15c07", name: "Bernstein" },
  { hex: "#0e7490", name: "Petrol" },
  { hex: "#3f3f46", name: "Graphit" },
  { hex: "#9d174d", name: "Beere" },
  { hex: "#5b21b6", name: "Viola" },
];

export function DesignPanel() {
  const { state, api } = useBuilder();
  const s = state.def.settings;
  const t = s.theme;
  const setTheme = (patch: Partial<Theme>, key?: string) => api.mutate((d) => void Object.assign(d.settings.theme, patch), key);
  const setS = (patch: Partial<typeof s>, key?: string) => api.mutate((d) => void Object.assign(d.settings, patch), key);
  const [hex, setHex] = useState(t.accent);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHex(t.accent);
  }, [t.accent]);

  return (
    <div>
      <Section title="Darstellung">
        <Row label="Modus" hint={s.mode === "classic" ? "Alle Fragen untereinander, Seiten als Abschnitte." : s.mode === "cards" ? "Eine Frage pro Bildschirm, mit Tastatur bedienbar." : "Schritt für Schritt mit Fortschritt und optionaler Zusammenfassung."}>
          <Segmented label="Modus" size="sm" value={s.mode} onChange={(m) => setS({ mode: m })} options={[{ value: "classic", label: "Classic" }, { value: "cards", label: "Cards" }, { value: "wizard", label: "Wizard" }]} />
        </Row>
        <Toggle label="Fortschritt anzeigen" checked={s.showProgress} onChange={(b) => setS({ showProgress: b })} />
        <Toggle label="Zusammenfassung vor dem Absenden" hint="Nur im Wizard-Modus." checked={s.reviewStep} onChange={(b) => setS({ reviewStep: b })} disabled={s.mode !== "wizard"} />
        <Toggle label="Später fortsetzen erlauben" hint="Ausfüllende erhalten einen privaten Link zu ihrem Zwischenstand." checked={s.allowResume} onChange={(b) => setS({ allowResume: b })} />
        <TextIn label="Beschriftung des Absende-Buttons" value={s.submitLabel} maxLength={80} onChange={(v) => setS({ submitLabel: v || "Absenden" }, "submit-label")} />
        <NativeSelect label="Sprache der Meldungen" value={s.language} onChange={(l) => setS({ language: l })} options={[{ value: "de", label: "Deutsch" }, { value: "en", label: "Englisch" }]} />
      </Section>
      <Section title="Farbe">
        <div className="grid grid-cols-10 gap-1.5" role="radiogroup" aria-label="Akzentfarbe">
          {ACCENTS.map((a) => (
            <button key={a.hex} type="button" role="radio" aria-checked={t.accent.toLowerCase() === a.hex} aria-label={a.name} title={a.name} onClick={() => setTheme({ accent: a.hex })} className="grid aspect-square place-items-center rounded-md ring-offset-2 ring-offset-paper transition-transform hover:scale-105 aria-checked:ring-2 aria-checked:ring-ink" style={{ background: a.hex }}>
              {t.accent.toLowerCase() === a.hex && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={t.accent} onChange={(e) => setTheme({ accent: e.target.value }, "accent")} aria-label="Eigene Farbe wählen" className="size-8 cursor-pointer rounded-md border border-line bg-paper p-0.5" />
          <input
            value={hex}
            aria-label="Farbwert"
            onChange={(e) => {
              setHex(e.target.value);
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setTheme({ accent: e.target.value.toLowerCase() }, "accent");
            }}
            aria-invalid={!/^#[0-9a-fA-F]{6}$/.test(hex)}
            className={cn(insInput, "w-28 font-mono text-[12.5px]")}
          />
        </div>
      </Section>
      <Section title="Form">
        <Row label="Ecken">
          <Segmented label="Ecken" size="sm" value={t.radius} onChange={(r) => setTheme({ radius: r })} options={[{ value: "none", label: "Eckig" }, { value: "small", label: "Leicht" }, { value: "medium", label: "Mittel" }, { value: "large", label: "Rund" }]} />
        </Row>
        <Row label="Schrift">
          <Segmented label="Schrift" size="sm" value={t.font} onChange={(f) => setTheme({ font: f })} options={[{ value: "sans", label: "Grotesk" }, { value: "serif", label: "Serif" }, { value: "mono", label: "Mono" }]} />
        </Row>
        <LogoUpload logo={t.logoFileId} onChange={(id) => setTheme({ logoFileId: id })} />
      </Section>
    </div>
  );
}

function LogoUpload({ logo, onChange }: { logo?: string; onChange: (id: string | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? "Hochladen fehlgeschlagen.");
      onChange(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hochladen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Row label="Logo" hint="Erscheint über dem Formulartitel. PNG, JPG, WebP oder GIF.">
      <div className="flex items-center gap-2">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/public/assets/${logo}`} alt="Aktuelles Logo" className="h-9 max-w-28 rounded-sm border border-line object-contain p-1" />
        )}
        <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-[12.5px] text-ink-2 hover:border-stamp hover:text-stamp">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {logo ? "Ersetzen" : "Logo hochladen"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {logo && <Button size="icon-sm" variant="ghost" aria-label="Logo entfernen" onClick={() => onChange(undefined)}><Trash2 /></Button>}
      </div>
    </Row>
  );
}
