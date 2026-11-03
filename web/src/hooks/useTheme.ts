import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// One theme for the whole page: every useTheme() caller (header toggle, Monaco) sees the same value.
const listeners = new Set<() => void>();

function initial(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let current: Theme = initial();
document.documentElement.classList.toggle("dark", current === "dark");

function setTheme(next: Theme) {
  current = next;
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current);
  return { theme, toggle: () => setTheme(current === "dark" ? "light" : "dark") };
}
