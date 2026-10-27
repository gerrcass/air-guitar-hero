import type { Arrangement } from "../audio/types";
import type { Chart } from "../game/types";

export type VenueId = "rusty-anchor" | "neon-cathedral" | "orbit-arena";

export type SongStyle = "garage" | "punk" | "doom" | "synthwave" | "electro" | "arena" | "dream";

export interface Palette {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly glow: string;
  readonly background: string;
  readonly ink: string;
}

export interface SectionWeight {
  readonly role: "intro" | "verse" | "chorus" | "bridge" | "solo" | "outro";
  readonly weight: number;
}

export interface SongDefinition {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly year: number;
  readonly genre: string;
  readonly venueId: VenueId;
  readonly bpm: number;
  /** MIDI note of the tonic in the bass octave. */
  readonly root: number;
  readonly mode: "minor" | "major";
  readonly style: SongStyle;
  readonly targetDuration: number;
  readonly difficultyRating: number;
  readonly palette: Palette;
  readonly sectionWeights: readonly SectionWeight[];
  readonly progression: readonly number[];
  readonly chorusProgression: readonly number[];
  readonly bridgeProgression: readonly number[];
  /** Eight on/off slots per bar for the lead line at the song's grid. */
  readonly motif: readonly number[];
  readonly contour: readonly number[];
  readonly laneBias: number;
  readonly seed: number;
}

export interface VenueDefinition {
  readonly id: VenueId;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly palette: Palette;
}

export interface ComposedSong {
  readonly song: SongDefinition;
  readonly arrangement: Arrangement;
  readonly charts: Readonly<Record<"easy" | "medium" | "hard" | "expert", Chart>>;
}
