import { SONG_BY_ID } from "../content/songs";
import { DIFFICULTIES, type Difficulty } from "../game/types";
import { DEFAULT_GUITAR_ID, GUITAR_FINISHES, unlockedGuitarsForStars } from "./cosmetics";
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from "./settings";

export const SAVE_KEY = "air-guitar-hero.save.v1";
export const SAVE_VERSION = 1 as const;

export type GameMode = "career" | "quickplay" | "practice" | "tutorial" | "faceoff";

export const GAME_MODES: readonly GameMode[] = [
  "career",
  "quickplay",
  "practice",
  "tutorial",
  "faceoff",
];

export interface BestRun {
  readonly score: number;
  readonly stars: number;
  readonly accuracy: number;
  readonly maxStreak: number;
}

export interface CareerProgress {
  /** Cleared songs in this difficulty, mapped to their best star rating (1–5). */
  readonly cleared: Readonly<Record<string, number>>;
}

export interface SaveData {
  readonly version: typeof SAVE_VERSION;
  readonly settings: Settings;
  readonly career: Readonly<Record<Difficulty, CareerProgress>>;
  readonly best: Readonly<Record<string, BestRun>>;
  readonly unlockedGuitars: readonly string[];
  readonly equippedGuitar: string;
  readonly stats: {
    readonly runs: number;
    readonly notesHit: number;
    readonly stars: number;
  };
  readonly lastMode: GameMode;
  readonly lastDifficulty: Difficulty;
  readonly lastSongId: string | null;
  readonly tutorialComplete: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DIFFICULTY_SET = new Set<string>(DIFFICULTIES);
const MODE_SET = new Set<string>(GAME_MODES);
const GUITAR_SET = new Set(GUITAR_FINISHES.map((guitar) => guitar.id));

function emptyCareer(): Record<Difficulty, CareerProgress> {
  return {
    easy: { cleared: {} },
    medium: { cleared: {} },
    hard: { cleared: {} },
    expert: { cleared: {} },
  };
}

export function careerStarTotal(save: Pick<SaveData, "career">): number {
  let total = 0;
  for (const difficulty of DIFFICULTIES) {
    for (const stars of Object.values(save.career[difficulty].cleared)) total += stars;
  }
  return total;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: DEFAULT_SETTINGS,
    career: emptyCareer(),
    best: {},
    unlockedGuitars: [DEFAULT_GUITAR_ID],
    equippedGuitar: DEFAULT_GUITAR_ID,
    stats: { runs: 0, notesHit: 0, stars: 0 },
    lastMode: "career",
    lastDifficulty: "medium",
    lastSongId: null,
    tutorialComplete: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function int(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function clamp01(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function careerFrom(raw: unknown): Record<Difficulty, CareerProgress> {
  const career = emptyCareer();
  if (!isRecord(raw)) return career;
  for (const difficulty of DIFFICULTIES) {
    const entry = raw[difficulty];
    if (!isRecord(entry)) continue;
    const clearedRaw = isRecord(entry.cleared) ? entry.cleared : entry;
    const cleared: Record<string, number> = {};
    for (const [songId, value] of Object.entries(clearedRaw)) {
      if (!SONG_BY_ID.has(songId)) continue;
      const stars = typeof value === "number" ? Math.round(value) : 0;
      if (stars >= 1 && stars <= 5) cleared[songId] = stars;
    }
    career[difficulty] = { cleared };
  }
  return career;
}

function bestFrom(raw: unknown): Record<string, BestRun> {
  const best: Record<string, BestRun> = {};
  if (!isRecord(raw)) return best;
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const separator = key.lastIndexOf(":");
    if (separator <= 0) continue;
    const songId = key.slice(0, separator);
    const difficulty = key.slice(separator + 1);
    if (!SONG_BY_ID.has(songId) || !DIFFICULTY_SET.has(difficulty)) continue;
    best[key] = {
      score: int(value.score),
      stars: Math.min(
        5,
        Math.max(0, Math.round(typeof value.stars === "number" ? value.stars : 0)),
      ),
      accuracy: clamp01(value.accuracy),
      maxStreak: int(value.maxStreak),
    };
  }
  return best;
}

function sanitize(input: unknown): SaveData {
  const defaults = defaultSave();
  if (!isRecord(input)) return defaults;
  const career = careerFrom(input.career);
  const best = bestFrom(input.best);
  const totalStars = careerStarTotal({ career });
  const storedGuitars = Array.isArray(input.unlockedGuitars)
    ? input.unlockedGuitars.filter(
        (id): id is string => typeof id === "string" && GUITAR_SET.has(id),
      )
    : [];
  const unlockedGuitars = [
    ...new Set([...unlockedGuitarsForStars(totalStars), ...storedGuitars, DEFAULT_GUITAR_ID]),
  ];
  const equipped =
    typeof input.equippedGuitar === "string" && unlockedGuitars.includes(input.equippedGuitar)
      ? input.equippedGuitar
      : DEFAULT_GUITAR_ID;
  const statsRaw = isRecord(input.stats) ? input.stats : {};
  const mode =
    typeof input.lastMode === "string" && MODE_SET.has(input.lastMode)
      ? (input.lastMode as GameMode)
      : defaults.lastMode;
  const difficulty =
    typeof input.lastDifficulty === "string" && DIFFICULTY_SET.has(input.lastDifficulty)
      ? (input.lastDifficulty as Difficulty)
      : defaults.lastDifficulty;
  const lastSongId =
    typeof input.lastSongId === "string" && SONG_BY_ID.has(input.lastSongId)
      ? input.lastSongId
      : null;
  return {
    version: SAVE_VERSION,
    settings: mergeSettings(input.settings),
    career,
    best,
    unlockedGuitars,
    equippedGuitar: equipped,
    stats: {
      runs: int(statsRaw.runs),
      notesHit: int(statsRaw.notesHit),
      stars: totalStars,
    },
    lastMode: mode,
    lastDifficulty: difficulty,
    lastSongId,
    tutorialComplete: input.tutorialComplete === true,
  };
}

function migrate(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version;
  if (version === SAVE_VERSION) return raw;
  if (version === 0 || version === undefined) {
    // v0 stored career as Record<difficulty, Record<songId, stars>> and had no cosmetics.
    return {
      ...raw,
      version: SAVE_VERSION,
      career: raw.career,
      unlockedGuitars: [DEFAULT_GUITAR_ID],
      equippedGuitar: DEFAULT_GUITAR_ID,
      tutorialComplete: raw.tutorialComplete === true,
      lastMode: raw.lastMode ?? "career",
      lastDifficulty: raw.lastDifficulty ?? "medium",
      lastSongId: raw.lastSongId ?? null,
    };
  }
  return defaultSave();
}

export function parseSave(json: string | null): SaveData {
  if (!json) return defaultSave();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return defaultSave();
  }
  try {
    return sanitize(migrate(raw));
  } catch {
    return defaultSave();
  }
}

export function memoryStorage(): StorageLike & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(storage: StorageLike | null = browserStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    return parseSave(storage.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function persistSave(
  save: SaveData,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...save,
        version: SAVE_VERSION,
        stats: { ...save.stats, stars: careerStarTotal(save) },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage: StorageLike | null = browserStorage()): SaveData {
  if (storage) {
    try {
      storage.removeItem(SAVE_KEY);
    } catch {
      // A blocked storage API still resets the in-memory session.
    }
  }
  return defaultSave();
}

export function withSettings(save: SaveData, patch: Partial<Settings>): SaveData {
  return { ...save, settings: mergeSettings({ ...save.settings, ...patch }) };
}

export function withEquippedGuitar(save: SaveData, guitarId: string): SaveData {
  if (!save.unlockedGuitars.includes(guitarId)) return save;
  return { ...save, equippedGuitar: guitarId };
}

export function bestKey(songId: string, difficulty: Difficulty): string {
  return `${songId}:${difficulty}`;
}
