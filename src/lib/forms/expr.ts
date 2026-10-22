/**
 * Sichere Ausdruckssprache für berechnete Felder.
 *
 * Kein eval, kein Function-Konstruktor: eigener Tokenizer + Pratt-Parser.
 * Unterstützt Zahlen, Strings, {feld_key}, + - * / % ^, Vergleiche,
 * && || !, sowie Funktionen (sum, min, max, round, floor, ceil, abs, if,
 * count, avg, days_between, years_since, len, concat).
 */

export type Value = number | string | boolean | null | Value[];

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; key: string }
  | { k: "un"; op: string; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; fn: string; args: Node[] };

export class ExprError extends Error {}

const FUNCS = new Set([
  "sum", "min", "max", "round", "floor", "ceil", "abs", "if", "count", "avg",
  "days_between", "years_since", "len", "concat",
]);

type Tok = { t: "num" | "str" | "ref" | "id" | "op" | "(" | ")" | ","; v: string; pos: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) throw new ExprError(`Ungültige Zahl „${raw}“`);
      out.push({ t: "num", v: raw, pos: i });
      i = j;
      continue;
    }
    if (c === "{") {
      const j = src.indexOf("}", i);
      if (j < 0) throw new ExprError("Fehlende schließende Klammer }");
      const key = src.slice(i + 1, j).trim();
      if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new ExprError(`Ungültiger Feldverweis {${key}}`);
      out.push({ t: "ref", v: key, pos: i });
      i = j + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\" && j + 1 < src.length) { s += src[j + 1]; j += 2; continue; }
        s += src[j++];
      }
      if (j >= src.length) throw new ExprError("Nicht abgeschlossener Text");
      out.push({ t: "str", v: s, pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j).toLowerCase(), pos: i });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) { out.push({ t: "op", v: two, pos: i }); i += 2; continue; }
    if ("+-*/%^<>!".includes(c)) { out.push({ t: "op", v: c, pos: i }); i++; continue; }
    if (c === "(" || c === ")" || c === ",") { out.push({ t: c, v: c, pos: i }); i++; continue; }
    throw new ExprError(`Unerwartetes Zeichen „${c}“`);
  }
  return out;
}

const BIN_PREC: Record<string, number> = {
  "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5, "*": 6, "/": 6, "%": 6, "^": 8,
};

const MAX_NODES = 500;

export function parseExpression(src: string): Node {
  if (src.length > 2000) throw new ExprError("Ausdruck ist zu lang");
  const toks = tokenize(src);
  let p = 0;
  let nodes = 0;
  const node = (n: Node): Node => {
    if (++nodes > MAX_NODES) throw new ExprError("Ausdruck ist zu komplex");
    return n;
  };
  const peek = () => toks[p];
  const expect = (t: Tok["t"]) => {
    const tok = toks[p];
    if (!tok || tok.t !== t) throw new ExprError(`„${t}“ erwartet`);
    p++;
    return tok;
  };

  function primary(): Node {
    const tok = toks[p++];
    if (!tok) throw new ExprError("Ausdruck ist unvollständig");
    switch (tok.t) {
      case "num": return node({ k: "num", v: Number(tok.v) });
      case "str": return node({ k: "str", v: tok.v });
      case "ref": return node({ k: "ref", key: tok.v });
      case "(": { const e = expr(0); expect(")"); return e; }
      case "op":
        if (tok.v === "-" || tok.v === "!") return node({ k: "un", op: tok.v, a: expr(7) });
        break;
      case "id": {
        if (tok.v === "true" || tok.v === "false") return node({ k: "num", v: tok.v === "true" ? 1 : 0 });
        if (!FUNCS.has(tok.v)) throw new ExprError(`Unbekannte Funktion „${tok.v}“`);
        expect("(");
        const args: Node[] = [];
        if (peek()?.t !== ")") {
          args.push(expr(0));
          while (peek()?.t === ",") { p++; args.push(expr(0)); }
        }
        expect(")");
        return node({ k: "call", fn: tok.v, args });
      }
    }
    throw new ExprError(`Unerwartetes „${tok.v}“`);
  }

  function expr(minPrec: number): Node {
    let left = primary();
    for (;;) {
      const tok = peek();
      if (!tok || tok.t !== "op" || !(tok.v in BIN_PREC)) break;
      const prec = BIN_PREC[tok.v];
      if (prec < minPrec) break;
      p++;
      // ^ ist rechtsassoziativ
      const right = expr(tok.v === "^" ? prec : prec + 1);
      left = node({ k: "bin", op: tok.v, a: left, b: right });
    }
    return left;
  }

  const result = expr(0);
  if (p < toks.length) throw new ExprError(`Unerwartetes „${toks[p].v}“`);
  return result;
}

/** Alle {key}-Verweise eines Ausdrucks (für Abhängigkeitsanalyse). */
export function expressionRefs(src: string): string[] {
  const refs = new Set<string>();
  const visit = (n: Node) => {
    if (n.k === "ref") refs.add(n.key);
    else if (n.k === "un") visit(n.a);
    else if (n.k === "bin") { visit(n.a); visit(n.b); }
    else if (n.k === "call") n.args.forEach(visit);
  };
  visit(parseExpression(src));
  return [...refs];
}

function toNum(v: Value): number {
  if (v === null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (Array.isArray(v)) return v.length;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function truthy(v: Value): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return !(v === null || v === "" || v === 0 || v === false);
}

function flat(vals: Value[]): Value[] {
  return vals.flatMap((v) => (Array.isArray(v) ? flat(v) : [v]));
}

function toDate(v: Value): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

export function evaluate(ast: Node, resolve: (key: string) => Value): Value {
  const ev = (n: Node): Value => {
    switch (n.k) {
      case "num": return n.v;
      case "str": return n.v;
      case "ref": return resolve(n.key) ?? null;
      case "un": return n.op === "-" ? -toNum(ev(n.a)) : !truthy(ev(n.a));
      case "bin": {
        if (n.op === "&&") return truthy(ev(n.a)) && truthy(ev(n.b));
        if (n.op === "||") return truthy(ev(n.a)) || truthy(ev(n.b));
        const a = ev(n.a);
        const b = ev(n.b);
        switch (n.op) {
          case "+":
            if (typeof a === "string" && typeof b === "string" && (Number.isNaN(Number(a)) || Number.isNaN(Number(b)))) return a + b;
            return toNum(a) + toNum(b);
          case "-": return toNum(a) - toNum(b);
          case "*": return toNum(a) * toNum(b);
          case "/": { const d = toNum(b); return d === 0 ? null : toNum(a) / d; }
          case "%": { const d = toNum(b); return d === 0 ? null : toNum(a) % d; }
          case "^": return Math.pow(toNum(a), toNum(b));
          case "==": return String(a ?? "") === String(b ?? "");
          case "!=": return String(a ?? "") !== String(b ?? "");
          case "<": return toNum(a) < toNum(b);
          case "<=": return toNum(a) <= toNum(b);
          case ">": return toNum(a) > toNum(b);
          case ">=": return toNum(a) >= toNum(b);
        }
        return null;
      }
      case "call": {
        if (n.fn === "if") {
          if (n.args.length < 2) throw new ExprError("if(bedingung, dann, sonst) erwartet");
          return truthy(ev(n.args[0])) ? ev(n.args[1]) : n.args[2] ? ev(n.args[2]) : null;
        }
        const args = n.args.map(ev);
        const nums = flat(args).filter((v) => v !== null && v !== "").map(toNum);
        switch (n.fn) {
          case "sum": return nums.reduce((s, x) => s + x, 0);
          case "min": return nums.length ? Math.min(...nums) : null;
          case "max": return nums.length ? Math.max(...nums) : null;
          case "avg": return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null;
          case "count": return flat(args).filter((v) => v !== null && v !== "" && v !== false).length;
          case "abs": return Math.abs(toNum(args[0] ?? 0));
          case "floor": return Math.floor(toNum(args[0] ?? 0));
          case "ceil": return Math.ceil(toNum(args[0] ?? 0));
          case "round": {
            const d = Math.max(0, Math.min(10, Math.trunc(toNum(args[1] ?? 0))));
            const f = 10 ** d;
            return Math.round(toNum(args[0] ?? 0) * f) / f;
          }
          case "len": return Array.isArray(args[0]) ? args[0].length : String(args[0] ?? "").length;
          case "concat": return args.map((a) => (a === null ? "" : Array.isArray(a) ? a.join(", ") : String(a))).join("");
          case "days_between": {
            const a = toDate(args[0] ?? null);
            const b = toDate(args[1] ?? null);
            return a === null || b === null ? null : Math.round((b - a) / 86_400_000);
          }
          case "years_since": {
            const a = toDate(args[0] ?? null);
            if (a === null) return null;
            const from = new Date(a);
            const now = new Date();
            let y = now.getUTCFullYear() - from.getUTCFullYear();
            if (now.getUTCMonth() < from.getUTCMonth() || (now.getUTCMonth() === from.getUTCMonth() && now.getUTCDate() < from.getUTCDate())) y--;
            return y;
          }
        }
        return null;
      }
    }
  };
  return ev(ast);
}

/** Bequemer Einstieg: Fehler werden zu null (Formular darf nie abstürzen). */
export function evaluateSafe(src: string, resolve: (key: string) => Value): Value {
  try {
    const v = evaluate(parseExpression(src), resolve);
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}
