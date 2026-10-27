/** Canonical domain types for the Air Guitar Hero engine. */

export type Lane = 0 | 1 | 2 | 3 | 4;
export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type Judgement = "perfect" | "great" | "good" | "miss";

export const LANES: readonly Lane[] = [0, 1, 2, 3, 4];
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard", "expert"];

export interface NoteGroup {
  readonly id: number;
  /** Seconds from song start. */
  readonly time: number;
  readonly lanes: readonly Lane[];
  /** Seconds; 0 for a gem. */
  readonly duration: number;
  /** Belongs to a star phrase. */
  readonly star: boolean;
  /** Frettable without strum. Never true on a chord. */
  readonly hopo: boolean;
}

export interface Section {
  readonly id: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

export interface Chart {
  readonly songId: string;
  readonly difficulty: Difficulty;
  readonly notes: readonly NoteGroup[];
  readonly sections: readonly Section[];
  readonly duration: number;
  readonly parScore: number;
  readonly bpm: number;
}

export type NoteStatus = "pending" | "skipped" | "holding" | "hit" | "released" | "missed";

export interface NoteState {
  readonly id: number;
  readonly status: NoteStatus;
  readonly judgement: Judgement | null;
  readonly sustainTicks: number;
}

export type GameEvent =
  | {
      readonly type: "judgement";
      readonly time: number;
      readonly noteId: number;
      readonly judgement: Judgement;
      readonly points: number;
      readonly gemCount: number;
      /** True when the player triggered a HOPO by fretting alone. */
      readonly hopoHit?: boolean;
    }
  | { readonly type: "overstrum"; readonly time: number }
  | { readonly type: "starPhrase"; readonly time: number; readonly phraseIndex: number }
  | { readonly type: "starPowerActivated"; readonly time: number; readonly duration: number }
  | { readonly type: "starPowerExpired"; readonly time: number }
  | {
      readonly type: "sustainTick";
      readonly time: number;
      readonly noteId: number;
      readonly points: number;
      readonly starGain: number;
    }
  | { readonly type: "failed"; readonly time: number }
  | { readonly type: "finished"; readonly time: number };

export interface GameSnapshot {
  readonly time: number;
  readonly score: number;
  readonly streak: number;
  readonly maxStreak: number;
  readonly baseMultiplier: number;
  readonly multiplier: number;
  readonly rock: number;
  readonly starPower: number;
  readonly starPowerActive: boolean;
  readonly starPowerRemaining: number;
  readonly judgeCounts: Readonly<Record<Judgement, number>>;
  readonly noteStates: readonly NoteState[];
  readonly heldLanes: readonly boolean[];
  readonly failed: boolean;
  readonly finished: boolean;
  readonly accuracy: number;
  readonly sustainTicks: number;
  readonly starPowerActivations: number;
  readonly totalNotes: number;
  readonly judgedNotes: number;
}

export interface SessionOptions {
  readonly difficulty: Difficulty;
  readonly noFail?: boolean;
  /** When false, HOPO notes require a strum (accessibility relief). */
  readonly hopoEnabled?: boolean;
  /** Chart time the run starts at, used by Practice sections. */
  readonly startTime?: number;
  /** Chart time the run ends at, used by Practice sections. */
  readonly endTime?: number;
}
