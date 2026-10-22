/**
 * Einfaches Vorlagen-Markup für PDFs (bewusst klein, ohne HTML):
 *   # / ## / ###  Überschriften     - Aufzählung     --- Linie
 *   **fett**      {{schluessel}}     {{antworten}}    {{unterschrift:schluessel}}
 *   {{datum}} {{eingang}} {{nummer}} {{formular}} {{id}}
 * Platzhalter werden erst nach dem Markup ersetzt – Eingaben von
 * Einreichenden können also keine Formatierung einschleusen.
 */

export type Inline = { text: string; bold?: boolean };
export type Block =
  | { t: "h"; level: 1 | 2 | 3; inl: Inline[] }
  | { t: "p"; lines: Inline[][] }
  | { t: "list"; items: Inline[][] }
  | { t: "hr" }
  | { t: "answers" }
  | { t: "signature"; key: string };

export type Resolver = (name: string) => string;

function inlines(src: string, resolve: Resolver): Inline[] {
  const out: Inline[] = [];
  const parts = src.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const raw = bold ? part.slice(2, -2) : part;
    const text = raw.replace(/\{\{\s*([a-z][a-z0-9_:]*)\s*\}\}/g, (_, n: string) => resolve(n));
    if (text) out.push(bold ? { text, bold } : { text });
  }
  return out;
}

export function parseTemplate(src: string, resolve: Resolver): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] = [];
  let list: Inline[][] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", lines: para });
    if (list.length) blocks.push({ t: "list", items: list });
    para = [];
    list = [];
  };
  for (const rawLine of src.replace(/\r\n/g, "\n").split("\n").slice(0, 2000)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flush();
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, inl: inlines(h[2], resolve) });
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      flush();
      blocks.push({ t: "hr" });
      continue;
    }
    if (/^\{\{\s*antworten\s*\}\}$/.test(trimmed)) {
      flush();
      blocks.push({ t: "answers" });
      continue;
    }
    const sig = /^\{\{\s*unterschrift:([a-z][a-z0-9_]*)\s*\}\}$/.exec(trimmed);
    if (sig) {
      flush();
      blocks.push({ t: "signature", key: sig[1] });
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(trimmed);
    if (li) {
      if (para.length) {
        blocks.push({ t: "p", lines: para });
        para = [];
      }
      list.push(inlines(li[1], resolve));
      continue;
    }
    if (list.length) {
      blocks.push({ t: "list", items: list });
      list = [];
    }
    para.push(inlines(trimmed, resolve));
  }
  flush();
  return blocks;
}

export const DEFAULT_TEMPLATE = `# {{formular}}

Antwort Nr. {{nummer}}, eingegangen am {{eingang}}.

{{antworten}}`;
