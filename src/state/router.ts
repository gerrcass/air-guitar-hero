import { useSyncExternalStore } from "react";
import type { Difficulty } from "../game/types";
import type { GameMode } from "./save";

export type Route =
  | { name: "menu" }
  | { name: "career" }
  | { name: "quickplay" }
  | { name: "practice" }
  | { name: "tutorial" }
  | { name: "faceoff" }
  | { name: "settings" }
  | { name: "extras" }
  | {
      name: "play";
      mode: Extract<GameMode, "career" | "quickplay" | "practice" | "faceoff">;
      songId: string;
      difficulty: Difficulty;
      sectionId?: string;
      speed?: number;
      loop?: boolean;
    }
  | { name: "results" };

const DIFFICULTIES = new Set(["easy", "medium", "hard", "expert"]);
const PLAY_MODES = new Set(["career", "quickplay", "practice", "faceoff"]);

function parseDifficulty(value: string | null): Difficulty {
  return value && DIFFICULTIES.has(value) ? (value as Difficulty) : "medium";
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart = "", queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);
  const head = segments[0] ?? "";
  switch (head) {
    case "":
      return { name: "menu" };
    case "career":
    case "quickplay":
    case "practice":
    case "tutorial":
    case "faceoff":
    case "settings":
    case "extras":
    case "results":
      return { name: head };
    case "play": {
      const mode = segments[1] ?? "";
      const songId = segments[2] ?? "";
      if (!PLAY_MODES.has(mode) || !songId) return { name: "menu" };
      const speedValue = Number(query.get("speed"));
      const speed = Number.isFinite(speedValue) && speedValue > 0 ? speedValue : undefined;
      const sectionId = query.get("section") ?? undefined;
      return {
        name: "play",
        mode: mode as Extract<GameMode, "career" | "quickplay" | "practice" | "faceoff">,
        songId,
        difficulty: parseDifficulty(segments[3] ?? null),
        ...(sectionId ? { sectionId } : {}),
        ...(speed !== undefined ? { speed } : {}),
        loop: query.get("loop") === "1",
      };
    }
    default:
      return { name: "menu" };
  }
}

export function currentRoute(): Route {
  if (typeof window === "undefined") return { name: "menu" };
  return parseRoute(window.location.hash);
}

let snapshot: Route = currentRoute();
const listeners = new Set<() => void>();

function refresh(): void {
  snapshot = currentRoute();
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", refresh);
}

export function navigate(path: string): void {
  if (typeof window === "undefined") return;
  const target = path.startsWith("#") ? path : `#${path}`;
  if (window.location.hash === target) {
    refresh();
    return;
  }
  window.location.hash = target;
}

export function href(route: Route): string {
  switch (route.name) {
    case "play": {
      const params = new URLSearchParams();
      if (route.sectionId) params.set("section", route.sectionId);
      if (route.speed !== undefined) params.set("speed", String(route.speed));
      if (route.loop) params.set("loop", "1");
      const query = params.size > 0 ? `?${params.toString()}` : "";
      return `#/play/${route.mode}/${route.songId}/${route.difficulty}${query}`;
    }
    case "menu":
      return "#/";
    default:
      return `#/${route.name}`;
  }
}

export function routeTitle(route: Route): string {
  switch (route.name) {
    case "menu":
      return "Main menu";
    case "career":
      return "Career";
    case "quickplay":
      return "Quickplay";
    case "practice":
      return "Practice";
    case "tutorial":
      return "Tutorial";
    case "faceoff":
      return "Face-off";
    case "settings":
      return "Settings";
    case "extras":
      return "Controls & credits";
    case "play":
      return "Performance";
    case "results":
      return "Results";
  }
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function playHref(
  mode: "career" | "quickplay" | "practice" | "faceoff",
  songId: string,
  difficulty: Difficulty,
  options: { sectionId?: string; speed?: number; loop?: boolean } = {},
): string {
  return href({
    name: "play",
    mode,
    songId,
    difficulty,
    ...options,
  });
}
