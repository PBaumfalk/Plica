/** Feste Anzeige-Zeitzone: Server (oft UTC) und Browser zeigen dieselbe Uhrzeit. */
export const APP_TIME_ZONE = "Europe/Berlin";

/** „vor 5 Min.“, „gestern“, „12. März“ – kurz und deutsch. */
export function relativeTime(iso: string | Date, now = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 45) return "gerade eben";
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  const day = (x: Date) => x.toLocaleDateString("de-DE", { timeZone: APP_TIME_ZONE });
  if (h < 24 && day(d) === day(now)) return `vor ${h} Std.`;
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return `gestern, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE })}`;
  const sameYear = d.toLocaleDateString("de-DE", { year: "numeric", timeZone: APP_TIME_ZONE }) === now.toLocaleDateString("de-DE", { year: "numeric", timeZone: APP_TIME_ZONE });
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric", timeZone: APP_TIME_ZONE });
}

export function dateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE });
}

/**
 * Excel kennt keine Zeitzonen: exceljs schreibt UTC. Damit die Zelle die
 * Berliner Uhrzeit zeigt (wie Oberfläche, CSV und PDF), die Wanduhrzeit
 * als UTC-Zeitpunkt übergeben.
 */
export function berlinWallClock(d: Date): Date {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second));
}

