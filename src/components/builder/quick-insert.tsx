"use client";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { Blocks, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { CATEGORY_LABELS, FIELD_META, type Category } from "@/lib/forms/fields";
import type { FieldType } from "@/lib/forms/schema";
import { suggestFields } from "@/lib/forms/suggest";
import { useBuilder } from "./context";
import { FieldIcon } from "./field-icons";

const ORDER: Category[] = ["text", "contact", "choice", "number", "date", "media", "advanced", "layout"];
const groupCls = "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint";
const itemCls = "flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-[14px] data-[selected=true]:bg-desk-2";

/** „/“: Feld per Tastatur einfügen, direkt nach der Auswahl. */
export function QuickInsert({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insertType, insertBlock, blocks, state } = useBuilder();
  const suggestions = useMemo(() => (open ? suggestFields(state.def) : []), [open, state.def]);
  const pick = (fn: () => void) => {
    onOpenChange(false);
    requestAnimationFrame(fn);
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_17_23/0.2)] data-[state=open]:animate-fade-in" />
        <D.Content aria-describedby={undefined} className="fixed left-1/2 top-[16vh] z-50 w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 overflow-hidden rounded-lg bg-paper shadow-pop data-[state=open]:animate-pop-in">
          <D.Title className="sr-only">Feld einfügen</D.Title>
          <Command loop label="Feld einfügen">
            <Command.Input autoFocus placeholder="Feldtyp oder Baustein …" className="h-12 w-full border-b border-line bg-transparent px-4 text-[15px] outline-none placeholder:text-faint" />
            <Command.List className="max-h-[min(400px,55vh)] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-[13.5px] text-muted">Kein passender Feldtyp.</Command.Empty>
              {suggestions.length > 0 && (
                <Command.Group heading="Häufig ergänzt" className={groupCls}>
                  {suggestions.map((s) => (
                    <Command.Item key={s.id} value={`vorschlag ${s.title} ${s.id}`} onSelect={() => pick(() => insertType(s.type, s.overrides))} className={itemCls}>
                      <Sparkles className="size-4 text-stamp" /> {s.title}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {ORDER.map((cat) => (
                <Command.Group key={cat} heading={CATEGORY_LABELS[cat]} className={groupCls}>
                  {(Object.keys(FIELD_META) as FieldType[])
                    .filter((t) => FIELD_META[t].category === cat)
                    .map((t) => (
                      <Command.Item key={t} value={`${FIELD_META[t].label} ${FIELD_META[t].keywords} ${t}`} onSelect={() => pick(() => insertType(t))} className={itemCls}>
                        <FieldIcon type={t} className="size-4 text-muted" />
                        <span className="flex-1">{FIELD_META[t].label}</span>
                        <span className="text-[12px] text-faint">{FIELD_META[t].hint}</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
              {blocks.length > 0 && (
                <Command.Group heading="Bausteine" className={groupCls}>
                  {blocks.map((b) => (
                    <Command.Item key={b.id} value={`baustein ${b.name} ${b.id}`} onSelect={() => pick(() => insertBlock(b))} className={itemCls}>
                      <Blocks className="size-4 text-stamp" /> <span className="flex-1">{b.name}</span>
                      <span className="text-[12px] text-faint">{b.fields.length} Felder</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
