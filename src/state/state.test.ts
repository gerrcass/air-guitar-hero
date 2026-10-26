import { describe, expect, it } from "vitest";
import { SONGS_BY_VENUE } from "../content/songs";
import {
  careerStarSummary,
  difficultyStars,
  isSongUnlocked,
  isVenueUnlocked,
  lockReasonFor,
  type RunResult,
  recordRun,
  starsForScore,
} from "./career";
import { GUITAR_FINISHES, unlockedGuitarsForStars } from "./cosmetics";
import {
  careerStarTotal,
  defaultSave,
  loadSave,
  memoryStorage,
  parseSave,
  persistSave,
  resetSave,
  SAVE_KEY,
  type SaveData,
  withEquippedGuitar,
  withSettings,
} from "./save";
import { approachSeconds, calibratedTime, mergeSettings } from "./settings";
import { SaveStore } from "./store";

const ANCHOR = SONGS_BY_VENUE["rusty-anchor"];
const CATHEDRAL = SONGS_BY_VENUE["neon-cathedral"];

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    mode: "career",
    songId: ANCHOR[0]?.id ?? "neon-throttle",
    difficulty: "medium",
    score: 100_000,
    parScore: 100_000,
    passed: true,
    accuracy: 0.95,
    maxStreak: 120,
    notesHit: 240,
    ...overrides,
  };
}

function clear(save: SaveData, songId: string, difficulty: RunResult["difficulty"] = "medium") {
  return recordRun(save, result({ songId, difficulty, score: 100_000, parScore: 100_000 })).save;
}

describe("save", () => {
  it("returns defensive defaults for corrupt, missing, or future data", () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave("{not json")).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 99, settings: { noteSpeed: 3 } }))).toEqual(
      defaultSave(),
    );
    expect(parseSave(JSON.stringify({ version: 1, settings: "nope", career: [] }))).toEqual(
      defaultSave(),
    );
  });

  it("migrates a v0 document and keeps its progress", () => {
    const v0 = JSON.stringify({
      version: 0,
      settings: { noteSpeed: 4, calibrationMs: 20 },
      career: { medium: { "neon-throttle": 4 } },
      best: {
        "neon-throttle:medium": { score: 12345, stars: 4, accuracy: 0.9, maxStreak: 50 },
      },
      tutorialComplete: true,
    });
    const save = parseSave(v0);
    expect(save.version).toBe(1);
    expect(save.settings.noteSpeed).toBe(4);
    expect(save.settings.calibrationMs).toBe(20);
    expect(save.career.medium.cleared["neon-throttle"]).toBe(4);
    expect(save.best["neon-throttle:medium"]?.score).toBe(12345);
    expect(save.tutorialComplete).toBe(true);
    expect(save.unlockedGuitars.length).toBeGreaterThan(0);
  });

  it("clamps every untrusted settings value", () => {
    const settings = mergeSettings({
      noteSpeed: 99,
      calibrationMs: -9999,
      musicVolume: 4,
      sfxVolume: -3,
      crowdVolume: 0.33,
      noFail: "yes",
      leftyFlip: true,
    });
    expect(settings.noteSpeed).toBe(5);
    expect(settings.calibrationMs).toBe(-200);
    expect(settings.musicVolume).toBe(1);
    expect(settings.sfxVolume).toBe(0);
    expect(settings.crowdVolume).toBeCloseTo(0.33);
    expect(settings.noFail).toBe(false);
    expect(settings.leftyFlip).toBe(true);
  });

  it("round-trips through storage and resets cleanly", () => {
    const storage = memoryStorage();
    const save = clear(defaultSave(), ANCHOR[0]?.id ?? "neon-throttle");
    expect(persistSave(save, storage)).toBe(true);
    expect(storage.raw.has(SAVE_KEY)).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.career.medium.cleared[ANCHOR[0]?.id ?? "neon-throttle"]).toBe(5);
    expect(careerStarTotal(loaded)).toBe(5);
    const reset = resetSave(storage);
    expect(reset).toEqual(defaultSave());
    expect(storage.raw.has(SAVE_KEY)).toBe(false);
  });

  it("persists settings immediately through the store", () => {
    const storage = memoryStorage();
    const store = new SaveStore(storage);
    store.setSettings({ musicVolume: 0.12, noteSpeed: 4 });
    const reloaded = new SaveStore(storage);
    expect(reloaded.getSnapshot().settings.musicVolume).toBeCloseTo(0.12);
    expect(reloaded.getSnapshot().settings.noteSpeed).toBe(4);
  });

  it("applies calibration only to input time and maps speed to approach time", () => {
    expect(calibratedTime(10, 50)).toBeCloseTo(10.05);
    expect(calibratedTime(10, -40)).toBeCloseTo(9.96);
    expect(approachSeconds(1)).toBeGreaterThan(approachSeconds(5));
  });
});

describe("career rules", () => {
  it("opens exactly the first song of the first venue on a fresh save", () => {
    const save = defaultSave();
    expect(isVenueUnlocked(save, "medium", "rusty-anchor")).toBe(true);
    expect(isVenueUnlocked(save, "medium", "neon-cathedral")).toBe(false);
    expect(isSongUnlocked(save, "medium", ANCHOR[0]?.id ?? "")).toBe(true);
    expect(isSongUnlocked(save, "medium", ANCHOR[1]?.id ?? "")).toBe(false);
    expect(lockReasonFor(save, "medium", ANCHOR[1]?.id ?? "")).toContain("Neon Throttle");
    expect(lockReasonFor(save, "medium", CATHEDRAL[0]?.id ?? "")).toContain("previous venue");
  });

  it("unlocks songs in order, then the encore, then the next venue", () => {
    let save = defaultSave();
    const first = ANCHOR[0];
    const second = ANCHOR[1];
    const third = ANCHOR[2];
    const encore = ANCHOR[3];
    if (!first || !second || !third || !encore) throw new Error("fixture");

    save = clear(save, first.id);
    expect(isSongUnlocked(save, "medium", second.id)).toBe(true);
    expect(isSongUnlocked(save, "medium", third.id)).toBe(false);

    save = clear(save, second.id);
    expect(isSongUnlocked(save, "medium", third.id)).toBe(true);
    expect(isSongUnlocked(save, "medium", encore.id)).toBe(false);

    save = clear(save, third.id);
    expect(isSongUnlocked(save, "medium", encore.id)).toBe(true);
    expect(isVenueUnlocked(save, "medium", "neon-cathedral")).toBe(false);

    save = clear(save, encore.id);
    expect(isVenueUnlocked(save, "medium", "neon-cathedral")).toBe(true);
    expect(isSongUnlocked(save, "medium", CATHEDRAL[0]?.id ?? "")).toBe(true);
    expect(difficultyStars(save, "medium")).toBe(20);
    expect(careerStarTotal(save)).toBe(20);
  });

  it("tracks each difficulty independently", () => {
    let save = defaultSave();
    save = clear(save, ANCHOR[0]?.id ?? "", "easy");
    expect(isSongUnlocked(save, "easy", ANCHOR[1]?.id ?? "")).toBe(true);
    expect(isSongUnlocked(save, "medium", ANCHOR[1]?.id ?? "")).toBe(false);
    expect(isSongUnlocked(save, "hard", ANCHOR[1]?.id ?? "")).toBe(false);
    expect(isSongUnlocked(save, "expert", ANCHOR[1]?.id ?? "")).toBe(false);
  });

  it("never unlocks from a failed career run or from quickplay", () => {
    let save = defaultSave();
    save = recordRun(save, result({ passed: false, score: 10_000 })).save;
    expect(isSongUnlocked(save, "medium", ANCHOR[1]?.id ?? "")).toBe(false);
    expect(save.best["neon-throttle:medium"]).toBeUndefined();

    save = recordRun(save, result({ mode: "quickplay" })).save;
    expect(isSongUnlocked(save, "medium", ANCHOR[1]?.id ?? "")).toBe(false);
    expect(save.best["neon-throttle:medium"]?.score).toBe(100_000);

    save = recordRun(save, result({ mode: "practice" })).save;
    expect(save.best["neon-throttle:medium"]?.score).toBe(100_000);
    expect(save.stats.runs).toBe(2);
  });

  it("keeps the best stars and reports new-best transitions", () => {
    let save = defaultSave();
    const first = recordRun(save, result({ score: 50_000, parScore: 200_000 }));
    expect(first.stars).toBe(1);
    expect(first.newBest).toBe(true);
    save = first.save;

    const second = recordRun(save, result({ score: 40_000, parScore: 200_000 }));
    expect(second.newBest).toBe(false);
    expect(second.stars).toBe(1);
    expect(second.save.best["neon-throttle:medium"]?.score).toBe(50_000);

    const third = recordRun(save, result({ score: 180_000, parScore: 200_000 }));
    expect(third.newBest).toBe(true);
    expect(third.stars).toBe(5);
    expect(third.save.career.medium.cleared["neon-throttle"]).toBe(5);
  });

  it("awards stars at the exact score thresholds", () => {
    const par = 1000;
    expect(starsForScore(0, par, false)).toBe(0);
    expect(starsForScore(349, par, true)).toBe(1);
    expect(starsForScore(350, par, true)).toBe(2);
    expect(starsForScore(550, par, true)).toBe(3);
    expect(starsForScore(750, par, true)).toBe(4);
    expect(starsForScore(900, par, true)).toBe(5);
  });

  it("unlocks six guitar finishes at visible career-star thresholds", () => {
    expect(GUITAR_FINISHES).toHaveLength(6);
    expect(unlockedGuitarsForStars(0)).toEqual(["gaffer-tape"]);
    expect(unlockedGuitarsForStars(20)).toContain("chrome-shard");
    expect(unlockedGuitarsForStars(35)).not.toContain("neon-vein");
    expect(unlockedGuitarsForStars(36)).toContain("neon-vein");
    expect(unlockedGuitarsForStars(90)).toHaveLength(6);
  });

  it("summarises stars by difficulty", () => {
    let save = defaultSave();
    save = clear(save, ANCHOR[0]?.id ?? "", "easy");
    save = clear(save, ANCHOR[0]?.id ?? "", "hard");
    const summary = careerStarSummary(save);
    expect(summary.byDifficulty.easy).toBe(5);
    expect(summary.byDifficulty.hard).toBe(5);
    expect(summary.byDifficulty.medium).toBe(0);
    expect(summary.total).toBe(10);
  });

  it("keeps the equipped guitar only when it is unlocked", () => {
    const save = defaultSave();
    const locked = withEquippedGuitar(save, "gold-record");
    expect(locked.equippedGuitar).toBe("gaffer-tape");
    const unlocked = { ...save, unlockedGuitars: [...save.unlockedGuitars, "gold-record"] };
    expect(withEquippedGuitar(unlocked, "gold-record").equippedGuitar).toBe("gold-record");
  });

  it("marks the tutorial complete once and keeps it across reloads", () => {
    const storage = memoryStorage();
    const store = new SaveStore(storage);
    store.completeTutorial();
    expect(store.getSnapshot().tutorialComplete).toBe(true);
    expect(new SaveStore(storage).getSnapshot().tutorialComplete).toBe(true);
  });

  it("merges settings without dropping career progress", () => {
    const save = clear(defaultSave(), ANCHOR[0]?.id ?? "");
    const updated = withSettings(save, { noteSpeed: 1, noFail: true });
    expect(updated.settings.noteSpeed).toBe(1);
    expect(updated.settings.noFail).toBe(true);
    expect(updated.career.medium.cleared[ANCHOR[0]?.id ?? ""]).toBe(5);
  });
});
