"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Filter leben in der URL – teilbar, mit Zurück-Taste, serverseitig gerendert. */
export function useQueryNav(current: Record<string, string>) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const set = useCallback(
    (patch: Record<string, string | null>, opts: { keepPage?: boolean; base?: string } = {}) => {
      const p = new URLSearchParams(current);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      if (!opts.keepPage && !("page" in patch)) p.delete("page");
      const qs = p.toString();
      start(() => router.replace(`${opts.base ?? path}${qs ? `?${qs}` : ""}`, { scroll: false }));
    },
    [current, path, router],
  );
  const replaceAll = useCallback(
    (q: Record<string, string>, base?: string) => {
      const qs = new URLSearchParams(q).toString();
      start(() => router.replace(`${base ?? path}${qs ? `?${qs}` : ""}`, { scroll: false }));
    },
    [path, router],
  );
  return { set, replaceAll, pending };
}

export function qs(q: Record<string, string>) {
  const s = new URLSearchParams(q).toString();
  return s ? `?${s}` : "";
}
