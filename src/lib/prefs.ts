import { useEffect, useState } from "react";

export const ACCENTS = [
  ["Teal", "#0F766E"],
  ["Blue", "#2563EB"],
  ["Amber", "#B45309"],
  ["Rose", "#BE123C"],
] as const;

export const DEFAULT_PREFS = {
  theme: "system",
  uiStyle: "toolbar",
  accent: "#0F766E",
  side: "right",
  thumbs: "1",
  snap: "1",
  spelling: "en-GB",
  editText: "panel",
  autosave: "1",
  marginOn: "0",
  marginPt: "36",
};
export type Prefs = typeof DEFAULT_PREFS;
export type SetPref = (key: keyof Prefs, value: string) => void;

export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

export function usePref(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

export function usePrefs() {
  const pairs = {
    theme: usePref("theme", DEFAULT_PREFS.theme),
    uiStyle: usePref("uiStyle", DEFAULT_PREFS.uiStyle),
    accent: usePref("accent", DEFAULT_PREFS.accent),
    side: usePref("side", DEFAULT_PREFS.side),
    thumbs: usePref("thumbs", DEFAULT_PREFS.thumbs),
    snap: usePref("snap", DEFAULT_PREFS.snap),
    spelling: usePref("spelling", DEFAULT_PREFS.spelling),
    editText: usePref("editText", DEFAULT_PREFS.editText),
    autosave: usePref("autosave", DEFAULT_PREFS.autosave),
    marginOn: usePref("marginOn", DEFAULT_PREFS.marginOn),
    marginPt: usePref("marginPt", DEFAULT_PREFS.marginPt),
  };
  const prefs = Object.fromEntries(Object.entries(pairs).map(([k, [v]]) => [k, v])) as Prefs;
  const setPref: SetPref = (k, v) => pairs[k][1](v);
  const resetPrefs = () => {
    for (const k of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) setPref(k, DEFAULT_PREFS[k]);
  };

  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const follow = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    m.addEventListener("change", follow);
    return () => m.removeEventListener("change", follow);
  }, []);
  const theme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
  useEffect(() => void (document.documentElement.dataset.theme = theme), [theme]);
  useEffect(() => {
    const hex = isHex(prefs.accent) ? prefs.accent : DEFAULT_PREFS.accent;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const s = document.documentElement.style;
    s.setProperty("--accent", hex);
    s.setProperty("--accent-rgb", `${r} ${g} ${b}`);
    s.setProperty("--on-accent", 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111113" : "#ffffff");
  }, [prefs.accent]);

  const margin = prefs.marginOn === "1" ? Math.max(0, +prefs.marginPt || 0) : null;
  return { prefs, setPref, resetPrefs, theme, margin };
}
