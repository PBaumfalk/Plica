"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/controls";

export type ThemePref = "system" | "light" | "dark";

export function applyTheme(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem("plica-theme");
    else localStorage.setItem("plica-theme", pref);
  } catch {}
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("plica-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (t === "light" || t === "dark") setPref(t);
    } catch {}
  }, []);
  return [pref, (p) => (setPref(p), applyTheme(p))];
}

export function ThemeSwitch() {
  const [pref, set] = useThemePref();
  return (
    <Segmented
      label="Darstellung"
      size="sm"
      value={pref}
      onChange={set}
      options={[
        { value: "light", label: <Sun />, title: "Hell" },
        { value: "system", label: <Monitor />, title: "Wie System" },
        { value: "dark", label: <Moon />, title: "Dunkel" },
      ]}
    />
  );
}
