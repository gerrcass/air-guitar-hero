export interface GuitarFinish {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly threshold: number;
  readonly body: string;
  readonly pickguard: string;
  readonly trim: string;
}

export const GUITAR_FINISHES: readonly GuitarFinish[] = [
  {
    id: "gaffer-tape",
    name: "Gaffer Tape",
    description: "Held together by the venue. Free with every new career.",
    threshold: 0,
    body: "#6b4b35",
    pickguard: "#d9cbb8",
    trim: "#a1876b",
  },
  {
    id: "copperhead",
    name: "Copperhead",
    description: "A warm copper burst for the first songs you own.",
    threshold: 8,
    body: "#c76a2f",
    pickguard: "#20130c",
    trim: "#f2b25c",
  },
  {
    id: "chrome-shard",
    name: "Chrome Shard",
    description: "Polished steel, cold lights, no fingerprints.",
    threshold: 20,
    body: "#9aa6b2",
    pickguard: "#1a1f26",
    trim: "#e8f1f8",
  },
  {
    id: "neon-vein",
    name: "Neon Vein",
    description: "Magenta wiring under black lacquer.",
    threshold: 36,
    body: "#241031",
    pickguard: "#ff2d95",
    trim: "#4de1ff",
  },
  {
    id: "voltage-crown",
    name: "Voltage Crown",
    description: "A cyan arc that never quite grounds itself.",
    threshold: 60,
    body: "#06333a",
    pickguard: "#33f0ff",
    trim: "#c6ff4d",
  },
  {
    id: "gold-record",
    name: "Gold Record",
    description: "The one they hang in the lobby. Earned, not bought.",
    threshold: 90,
    body: "#b98a27",
    pickguard: "#fff2bd",
    trim: "#ffe08a",
  },
];

export const DEFAULT_GUITAR_ID = "gaffer-tape";

export function unlockedGuitarsForStars(totalStars: number): string[] {
  return GUITAR_FINISHES.filter((guitar) => totalStars >= guitar.threshold).map(
    (guitar) => guitar.id,
  );
}

export function guitarById(id: string): GuitarFinish {
  return GUITAR_FINISHES.find((guitar) => guitar.id === id) ?? FALLBACK_FINISH;
}

const FALLBACK_FINISH: GuitarFinish = {
  id: "gaffer-tape",
  name: "Gaffer Tape",
  description: "Held together by the venue.",
  threshold: 0,
  body: "#6b4b35",
  pickguard: "#d9cbb8",
  trim: "#a1876b",
};
