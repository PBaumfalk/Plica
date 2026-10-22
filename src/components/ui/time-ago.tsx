"use client";
import { dateTime, relativeTime } from "@/lib/time";

/**
 * Relative Zeitangabe („vor 5 Min.“). Server und Browser rechnen mit
 * leicht unterschiedlichem „jetzt“ – das DOM des Servers gewinnt
 * (suppressHydrationWarning), beim nächsten Rendern zählt die Browserzeit.
 */
export function TimeAgo({ at, prefix = "" }: { at: string | Date; prefix?: string }) {
  const iso = typeof at === "string" ? at : at.toISOString();
  return (
    <time dateTime={iso} title={dateTime(iso)} suppressHydrationWarning>
      {prefix}
      {relativeTime(iso)}
    </time>
  );
}
