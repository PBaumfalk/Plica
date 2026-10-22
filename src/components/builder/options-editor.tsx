"use client";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/forms/fields";
import type { Option } from "@/lib/forms/schema";
import { insInput } from "./inspector-ui";

export function OptionsEditor({ options, onChange, label = "Antwortmöglichkeiten", noun = "Option", onValueRenamed }: { options: Option[]; onChange: (o: Option[]) => void; label?: string; noun?: string; onValueRenamed?: (from: string, to: string) => void }) {
  const dndId = useId();
  const [separate, setSeparate] = useState(() => options.some((o) => o.value !== o.label));
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const update = (id: string, patch: Partial<Option>) => {
    const old = options.find((o) => o.id === id)!;
    const next = { ...old, ...patch };
    if (patch.label !== undefined && !separate) next.value = patch.label;
    if (next.value !== old.value) onValueRenamed?.(old.value, next.value);
    onChange(options.map((o) => (o.id === id ? next : o)));
  };
  const add = (after?: string, label = "") => {
    const o: Option = { id: newId("o_"), label: label || `${noun} ${options.length + 1}`, value: label || `${noun} ${options.length + 1}` };
    const i = after ? options.findIndex((x) => x.id === after) + 1 : options.length;
    onChange([...options.slice(0, i), o, ...options.slice(i)]);
    setTimeout(() => refs.current[o.id]?.select(), 20);
  };
  const paste = (id: string, text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const i = options.findIndex((o) => o.id === id);
    const current = options[i];
    const fresh = lines.map((l) => ({ id: newId("o_"), label: l, value: l }));
    const replaceCurrent = !current.label || /^(Option|Zeile|Spalte|Aussage) \d+$/.test(current.label);
    onChange([...options.slice(0, replaceCurrent ? i : i + 1), ...fresh, ...options.slice(i + 1)]);
    return true;
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = options.findIndex((o) => o.id === e.active.id);
    const to = options.findIndex((o) => o.id === e.over!.id);
    onChange(arrayMove(options, from, to));
  };
  const dupes = new Set(options.map((o) => o.value).filter((v, i, a) => a.indexOf(v) !== i));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <Checkbox checked={separate} onCheckedChange={setSeparate} label="Gespeicherte Werte separat bearbeiten" />
          Werte separat
        </label>
      </div>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {options.map((o, i) => (
              <OptionRow
                key={o.id}
                option={o}
                index={i}
                separate={separate}
                duplicate={dupes.has(o.value)}
                inputRef={(el) => (refs.current[o.id] = el)}
                onChange={(p) => update(o.id, p)}
                onRemove={() => onChange(options.filter((x) => x.id !== o.id))}
                onEnter={() => add(o.id)}
                onPaste={(t) => paste(o.id, t)}
                canRemove={options.length > 1}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button type="button" onClick={() => add()} className="flex h-7 items-center gap-1.5 rounded-sm px-1.5 text-[12.5px] font-medium text-stamp hover:bg-stamp-soft">
        <Plus className="size-3.5" /> {noun} hinzufügen
      </button>
      <p className="text-[11.5px] text-faint">Tipp: Eine Liste mit mehreren Zeilen einfügen legt mehrere {noun === "Option" ? "Optionen" : `${noun}n`} auf einmal an.</p>
    </div>
  );
}

function OptionRow({ option, index, separate, duplicate, inputRef, onChange, onRemove, onEnter, onPaste, canRemove }: {
  option: Option;
  index: number;
  separate: boolean;
  duplicate: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (p: Partial<Option>) => void;
  onRemove: () => void;
  onEnter: () => void;
  onPaste: (text: string) => boolean;
  canRemove: boolean;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: option.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("group flex items-start gap-1", isDragging && "z-10 opacity-80")}>
      <button type="button" {...attributes} {...listeners} aria-label={`Option ${index + 1} verschieben`} className="mt-1 grid h-6 w-4 cursor-grab place-items-center text-faint hover:text-ink">
        <GripVertical className="size-3.5" />
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <input
          ref={inputRef}
          value={option.label}
          aria-label={`Option ${index + 1}`}
          onChange={(e) => onChange({ label: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          onPaste={(e) => {
            if (onPaste(e.clipboardData.getData("text"))) e.preventDefault();
          }}
          aria-invalid={duplicate || !option.label}
          className={insInput}
        />
        {separate && <input value={option.value} aria-label={`Gespeicherter Wert für Option ${index + 1}`} onChange={(e) => onChange({ value: e.target.value })} className={cn(insInput, "h-7 font-mono text-[12px] text-muted")} placeholder="Gespeicherter Wert" />}
      </div>
      <button type="button" onClick={onRemove} disabled={!canRemove} aria-label={`Option ${index + 1} entfernen`} className="mt-1 grid size-6 place-items-center rounded-sm text-faint opacity-0 hover:bg-desk-2 hover:text-bad focus-visible:opacity-100 disabled:hidden group-hover:opacity-100">
        <X className="size-3.5" />
      </button>
    </li>
  );
}
