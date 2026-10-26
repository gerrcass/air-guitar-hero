import { useSyncExternalStore } from "react";
import type { Difficulty } from "../game/types";
import { markTutorialComplete, type RecordedRun, type RunResult, recordRun } from "./career";
import {
  browserStorage,
  type GameMode,
  loadSave,
  persistSave,
  resetSave,
  type SaveData,
  type StorageLike,
  withEquippedGuitar,
  withSettings,
} from "./save";
import type { Settings } from "./settings";

export class SaveStore {
  private data: SaveData;
  private readonly storage: StorageLike | null;
  private readonly listeners = new Set<() => void>();

  constructor(storage: StorageLike | null = browserStorage()) {
    this.storage = storage;
    this.data = loadSave(storage);
  }

  getSnapshot = (): SaveData => this.data;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(next: SaveData): void {
    this.data = next;
    persistSave(next, this.storage);
    for (const listener of this.listeners) listener();
  }

  setSettings(patch: Partial<Settings>): void {
    this.commit(withSettings(this.data, patch));
  }

  setEquippedGuitar(guitarId: string): void {
    this.commit(withEquippedGuitar(this.data, guitarId));
  }

  recordRun(result: RunResult): RecordedRun {
    const recorded = recordRun(this.data, result);
    if (recorded.save !== this.data) this.commit(recorded.save);
    return recorded;
  }

  completeTutorial(): void {
    this.commit(markTutorialComplete(this.data));
  }

  rememberSelection(mode: GameMode, difficulty: Difficulty, songId: string | null): void {
    this.commit({
      ...this.data,
      lastMode: mode,
      lastDifficulty: difficulty,
      lastSongId: songId,
    });
  }

  reset(): void {
    this.data = resetSave(this.storage);
    for (const listener of this.listeners) listener();
  }
}

export const saveStore = new SaveStore();

export function useSave(): SaveData {
  return useSyncExternalStore(saveStore.subscribe, saveStore.getSnapshot, saveStore.getSnapshot);
}
