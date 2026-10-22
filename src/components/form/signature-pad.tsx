"use client";
/**
 * Unterschriftenfeld für Maus, Finger und Stift (Pointer Events).
 * Druckstärke des Stifts beeinflusst die Linienbreite. Ergebnis: PNG-Data-URL.
 */
import { Eraser, PenLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function SignaturePad({ id, value, onChange, disabled, invalid }: { id: string; value?: { dataUrl?: string; fileId?: string }; onChange: (v: unknown) => void; disabled?: boolean; invalid?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number; w: number } | null>(null);
  const [empty, setEmpty] = useState(!value?.dataUrl);

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#141a2e";
    if (value?.dataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = value.dataUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  function point(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    const pressure = e.pointerType === "pen" ? Math.max(0.15, e.pressure || 0.5) : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: 1 + pressure * 2.6 };
  }

  function down(e: React.PointerEvent) {
    if (disabled) return;
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineWidth = (last.current.w + p.w) / 2;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (!empty) onChange({ dataUrl: canvas.current!.toDataURL("image/png") });
  }
  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(undefined);
  }

  return (
    <div className="space-y-2">
      <div className={cn("relative overflow-hidden rounded-[var(--f-radius)] border bg-white", invalid ? "border-[var(--f-bad)]" : "border-[var(--f-line-strong)]")}>
        <canvas
          id={id}
          ref={canvas}
          role="img"
          aria-label="Unterschriftsfeld: mit Maus, Finger oder Stift unterschreiben"
          tabIndex={0}
          className="block h-40 w-full touch-none select-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-[#c5cad2]" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[14px] text-[#8a919c]">
            <PenLine className="size-4" /> Hier unterschreiben
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 text-[12.5px] text-[var(--f-muted)]">
        <span>Einfache elektronische Unterschrift – keine qualifizierte Signatur.</span>
        {!empty && (
          <button type="button" onClick={clear} disabled={disabled} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--f-tint)] hover:text-[var(--f-ink)]">
            <Eraser className="size-3.5" /> Löschen
          </button>
        )}
      </div>
    </div>
  );
}
