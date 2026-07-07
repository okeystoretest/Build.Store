"use client";

import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const COOKIE = "bs-theme";

function readCookieTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const match = document.cookie.match(/(?:^|;\s*)bs-theme=(light|dark)/);
  return (match?.[1] as Theme) ?? "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // 1-year cookie so SSR and the pre-paint script agree on the theme.
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Theme state. Reads the current theme from the cookie (already applied to
 * <html> by the pre-paint script), and exposes a toggle. Persisting via cookie
 * keeps the choice across sessions and avoids a flash on reload.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readCookieTheme());
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  const set = useCallback((next: Theme) => {
    applyTheme(next);
    setTheme(next);
  }, []);

  return { theme, toggle, set };
}
