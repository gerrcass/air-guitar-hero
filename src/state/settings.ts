export interface Settings {
  /** 1 (slow) to 5 (fast): approach time, never judgement. */
  readonly noteSpeed: number;
  readonly leftyFlip: boolean;
  readonly colorblindPalette: boolean;
  readonly laneSymbols: boolean;
  readonly reduceMotion: boolean;
  readonly staticHighway: boolean;
  readonly cameraShake: boolean;
  readonly noFail: boolean;
  /** −200…+200 ms added to input timestamps. */
  readonly calibrationMs: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly crowdVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  noteSpeed: 3,
  leftyFlip: false,
  colorblindPalette: false,
  laneSymbols: false,
  reduceMotion: false,
  staticHighway: false,
  cameraShake: true,
  noFail: false,
  calibrationMs: 0,
  musicVolume: 0.75,
  sfxVolume: 0.8,
  crowdVolume: 0.42,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Merge an untrusted settings fragment over defaults, clamping every numeric field. */
export function mergeSettings(raw: unknown): Settings {
  const source =
    raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : ({} as const);
  return {
    noteSpeed: Math.round(clamp(finite(source.noteSpeed, DEFAULT_SETTINGS.noteSpeed), 1, 5)),
    leftyFlip: boolean(source.leftyFlip, DEFAULT_SETTINGS.leftyFlip),
    colorblindPalette: boolean(source.colorblindPalette, DEFAULT_SETTINGS.colorblindPalette),
    laneSymbols: boolean(source.laneSymbols, DEFAULT_SETTINGS.laneSymbols),
    reduceMotion: boolean(source.reduceMotion, DEFAULT_SETTINGS.reduceMotion),
    staticHighway: boolean(source.staticHighway, DEFAULT_SETTINGS.staticHighway),
    cameraShake: boolean(source.cameraShake, DEFAULT_SETTINGS.cameraShake),
    noFail: boolean(source.noFail, DEFAULT_SETTINGS.noFail),
    calibrationMs: Math.round(
      clamp(finite(source.calibrationMs, DEFAULT_SETTINGS.calibrationMs), -200, 200),
    ),
    musicVolume: clamp(finite(source.musicVolume, DEFAULT_SETTINGS.musicVolume), 0, 1),
    sfxVolume: clamp(finite(source.sfxVolume, DEFAULT_SETTINGS.sfxVolume), 0, 1),
    crowdVolume: clamp(finite(source.crowdVolume, DEFAULT_SETTINGS.crowdVolume), 0, 1),
  };
}

/** Apply calibration to an audio timestamp without touching chart times. */
export function calibratedTime(audioSeconds: number, calibrationMs: number): number {
  return audioSeconds + calibrationMs / 1000;
}

/** Seconds a note is visible on the highway for a given 1–5 speed setting. */
export function approachSeconds(noteSpeed: number): number {
  const clamped = clamp(noteSpeed, 1, 5);
  return 2.6 - (clamped - 1) * 0.32;
}

/** Seconds per chart unit at a practice speed. */
export function practiceTimeScale(speed: number): number {
  return clamp(speed, 0.5, 1);
}

export function noteSpeedLabel(noteSpeed: number): string {
  return ["Slowest", "Slow", "Normal", "Fast", "Fastest"][clamp(noteSpeed, 1, 5) - 1] ?? "Normal";
}
