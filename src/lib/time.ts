/** „vor 5 Min.“, „gestern“, „12. März“ – kurz und deutsch. */
export function relativeTime(iso: string | Date, now = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 45) return "gerade eben";
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24 && d.getDate() === now.getDate()) return `vor ${h} Std.`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `gestern, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function dateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}
