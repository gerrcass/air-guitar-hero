import { useEffect, useMemo, useState } from "react";
import type { Settings } from "./settings";

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(query.matches);
    const listener = (event: MediaQueryListEvent): void => setPrefers(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return prefers;
}

/** Merge the player's setting with the operating-system preference. */
export function useEffectiveSettings(settings: Settings): Settings {
  const prefersReduced = usePrefersReducedMotion();
  return useMemo(
    () => ({ ...settings, reduceMotion: settings.reduceMotion || prefersReduced }),
    [settings, prefersReduced],
  );
}
