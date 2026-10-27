export type MelodicInstrument = "lead" | "rhythm" | "bass" | "pad";

export type DrumKind = "kick" | "snare" | "hat" | "open-hat" | "crash";

export interface MelodicEvent {
  readonly instrument: MelodicInstrument;
  /** Seconds from song start. */
  readonly time: number;
  readonly duration: number;
  readonly midi: number;
  readonly velocity: number;
}

export interface DrumEvent {
  readonly instrument: "drums";
  readonly time: number;
  readonly drum: DrumKind;
  readonly velocity: number;
}

export type AudioEvent = MelodicEvent | DrumEvent;

export interface Arrangement {
  readonly songId: string;
  readonly bpm: number;
  readonly duration: number;
  readonly style: string;
  readonly leadTone: "saw" | "square" | "triangle";
  readonly events: readonly AudioEvent[];
}
