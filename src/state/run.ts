import { useSyncExternalStore } from "react";
import type { Difficulty, Judgement } from "../game/types";
import type { GameMode } from "./save";

export interface CompletedRun {
  readonly mode: GameMode;
  readonly songId: string;
  readonly difficulty: Difficulty;
  readonly score: number;
  readonly accuracy: number;
  readonly maxStreak: number;
  readonly judgeCounts: Readonly<Record<Judgement, number>>;
  readonly passed: boolean;
  readonly stars: number;
  readonly newBest: boolean;
  readonly abandoned?: boolean;
  readonly sustainTicks: number;
  readonly starPowerActivations: number;
  readonly totalNotes: number;
  readonly sectionLabel?: string;
  readonly practiceSpeed?: number;
}

let lastRun: CompletedRun | null = null;
const listeners = new Set<() => void>();

export function setLastRun(run: CompletedRun | null): void {
  lastRun = run;
  for (const listener of listeners) listener();
}

export function getLastRun(): CompletedRun | null {
  return lastRun;
}

export function useLastRun(): CompletedRun | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => lastRun,
    () => lastRun,
  );
}
