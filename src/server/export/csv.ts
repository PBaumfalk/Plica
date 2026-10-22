/** CSV für deutsches Excel: UTF-8 mit BOM, Semikolon, Schutz vor Formel-Injection. */

const NUMERIC = /^-?\d+([.,]\d+)?$/;

/** Zellen, die mit = + - @ Tab oder CR beginnen, würden in Tabellenprogrammen als Formel ausgeführt. */
export function neutralize(value: string): string {
  if (value && /^[=+\-@\t\r]/.test(value) && !NUMERIC.test(value)) return `'${value}`;
  return value;
}

export function csvCell(value: string, delimiter = ";"): string {
  const v = neutralize(value);
  if (v.includes(delimiter) || v.includes('"') || v.includes("\n") || v.includes("\r")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function csvLine(cells: string[], delimiter = ";"): string {
  return cells.map((c) => csvCell(c, delimiter)).join(delimiter) + "\r\n";
}

export const BOM = "﻿";
