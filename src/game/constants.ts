import type { Difficulty } from "./types";

/** The judgement ladder. Difficulties only widen the outer "Good" edge. */
export const PERFECT_WINDOW = 0.045;
export const GREAT_WINDOW = 0.09;

export const GOOD_WINDOW: Readonly<Record<Difficulty, number>> = {
  easy: 0.16,
  medium: 0.15,
  hard: 0.14,
  expert: 0.135,
};

export const BASE_GEM_POINTS = 50;
export const SUSTAIN_TICK_POINTS = 10;
export const STAR_PHRASE_FILL = 0.25;
export const STAR_POWER_MIN_ACTIVATION = 0.25;
export const STAR_POWER_BEATS = 32;
export const STAR_POWER_MULTIPLIER = 2;

/** A short window after a fretted HOPO in which a strum is forgiven. */
export const HOPO_STRUM_GRACE = 0.12;

export const START_ROCK = 0.64;
export const ROCK_HIT_GAIN: Readonly<Record<"perfect" | "great" | "good", number>> = {
  perfect: 0.021,
  great: 0.016,
  good: 0.009,
};
export const ROCK_MISS_DRAIN = 0.062;
export const ROCK_OVERSTRUM_DRAIN = 0.045;

/** A quarter-note sustain tick grid, in beats. */
export const SUSTAIN_TICK_BEATS = 0.5;

export const MULTIPLIER_STEPS: readonly { readonly minStreak: number; readonly value: number }[] = [
  { minStreak: 30, value: 4 },
  { minStreak: 20, value: 3 },
  { minStreak: 10, value: 2 },
  { minStreak: 0, value: 1 },
];

export function multiplierForStreak(streak: number): number {
  for (const step of MULTIPLIER_STEPS) {
    if (streak >= step.minStreak) return step.value;
  }
  return 1;
}

export const JUDGEMENT_WEIGHT: Readonly<Record<"perfect" | "great" | "good", number>> = {
  perfect: 1,
  great: 0.75,
  good: 0.5,
};

export function starPowerDurationSeconds(bpm: number): number {
  return (STAR_POWER_BEATS * 60) / bpm;
}

export function sustainTickSeconds(bpm: number): number {
  return (SUSTAIN_TICK_BEATS * 60) / bpm;
}
