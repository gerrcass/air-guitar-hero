import type { Arrangement, AudioEvent } from "../audio/types";
import type { Chart, Difficulty, Lane, NoteGroup, Section } from "../game/types";
import type { SongDefinition } from "./types";

export type LessonId = "notes" | "chords" | "sustains" | "star" | "hopo";

export interface TutorialLesson {
  readonly id: LessonId;
  readonly index: number;
  readonly title: string;
  readonly summary: string;
  readonly instruction: string;
  readonly successHint: string;
  readonly difficulty: Difficulty;
  readonly chart: Chart;
  readonly arrangement: Arrangement;
  readonly song: SongDefinition;
  readonly requiresStarActivation: boolean;
}

const BPM = 88;
const BEAT = 60 / BPM;
const DURATION = 18;

interface LessonSeed {
  readonly id: LessonId;
  readonly title: string;
  readonly summary: string;
  readonly instruction: string;
  readonly successHint: string;
  readonly difficulty: Difficulty;
  readonly notes: readonly {
    time: number;
    lanes: readonly Lane[];
    duration?: number;
    star?: boolean;
    hopo?: boolean;
  }[];
  readonly requiresStarActivation?: boolean;
  readonly palette: SongDefinition["palette"];
}

function buildLesson(seed: LessonSeed, index: number): TutorialLesson {
  const notes: NoteGroup[] = seed.notes.map((note, noteIndex) => ({
    id: noteIndex,
    time: Math.round(note.time * 1000) / 1000,
    lanes: [...note.lanes].sort((a, b) => a - b),
    duration: note.duration ?? 0,
    star: note.star ?? false,
    hopo: note.hopo ?? false,
  }));
  const sections: Section[] = [{ id: "lesson", name: "Lesson", start: 0, end: DURATION }];
  const chart: Chart = {
    songId: "tutorial",
    difficulty: seed.difficulty,
    notes,
    sections,
    duration: DURATION,
    parScore: Math.max(100, notes.length * 50 * 2),
    bpm: BPM,
  };
  const song: SongDefinition = {
    id: "tutorial",
    title: seed.title,
    artist: "Air Guitar Hero",
    album: "First Steps",
    year: 2026,
    genre: "Lesson",
    venueId: "rusty-anchor",
    bpm: BPM,
    root: 40,
    mode: "minor",
    style: "garage",
    targetDuration: DURATION,
    difficultyRating: 1,
    palette: seed.palette,
    sectionWeights: [{ role: "verse", weight: 1 }],
    progression: [0],
    chorusProgression: [0],
    bridgeProgression: [0],
    motif: [1, 0, 0, 0, 0, 0, 0, 0],
    contour: [0],
    laneBias: 0,
    seed: 900 + index,
  };
  const events: AudioEvent[] = [];
  for (let beat = 0; beat < Math.floor(DURATION / BEAT); beat += 1) {
    const time = beat * BEAT;
    events.push({
      instrument: "drums",
      time,
      drum: beat % 4 === 0 || beat % 4 === 2 ? "kick" : "snare",
      velocity: 0.5,
    });
    events.push({ instrument: "drums", time, drum: "hat", velocity: 0.16 });
  }
  for (const note of notes) {
    for (const lane of note.lanes) {
      events.push({
        instrument: "lead",
        time: note.time,
        duration: Math.max(0.18, note.duration),
        midi: 48 + lane * 2 + (note.star ? 12 : 0),
        velocity: 0.7,
      });
    }
  }
  events.sort((a, b) => a.time - b.time);
  return {
    id: seed.id,
    index,
    title: seed.title,
    summary: seed.summary,
    instruction: seed.instruction,
    successHint: seed.successHint,
    difficulty: seed.difficulty,
    chart,
    arrangement: {
      songId: "tutorial",
      bpm: BPM,
      duration: DURATION,
      style: "garage",
      leadTone: "saw",
      events,
    },
    song,
    requiresStarActivation: seed.requiresStarActivation ?? false,
  };
}

const LESSON_SEEDS: readonly LessonSeed[] = [
  {
    id: "notes",
    title: "Single notes",
    summary: "Hold the matching fret and strum as the gem reaches the line.",
    instruction:
      "Each gem has a lane. Hold the matching fret (A, S, D, F, G) and press Space when the gem crosses the receptors. Timing is graded Perfect, Great, Good, or Miss.",
    successHint: "Hit at least half the notes. Timing is graded, not guessed.",
    difficulty: "easy",
    notes: [
      { time: 4, lanes: [0] },
      { time: 5.2, lanes: [1] },
      { time: 6.4, lanes: [2] },
      { time: 7.6, lanes: [3] },
      { time: 8.8, lanes: [4] },
      { time: 10, lanes: [2] },
      { time: 11.2, lanes: [1] },
      { time: 12.4, lanes: [0] },
    ],
    palette: {
      primary: "#ff9f43",
      secondary: "#4de1ff",
      accent: "#ffe14d",
      glow: "#ffb347",
      background: "#0c0805",
      ink: "#fff3df",
    },
  },
  {
    id: "chords",
    title: "Chords",
    summary: "Hold every lane in the group, then strum once.",
    instruction:
      "A chord is two gems stacked in time. Hold every matching fret before the strum; a partial hold does not count. The chord scores each gem but adds one to the streak.",
    successHint: "Complete at least half the chords.",
    difficulty: "medium",
    notes: [
      { time: 4, lanes: [0, 2] },
      { time: 6, lanes: [1, 3] },
      { time: 8, lanes: [2, 4] },
      { time: 10, lanes: [0, 3] },
      { time: 12, lanes: [1, 4] },
    ],
    palette: {
      primary: "#ff2d95",
      secondary: "#4de1ff",
      accent: "#a86bff",
      glow: "#ff62b0",
      background: "#0a0611",
      ink: "#f7efff",
    },
  },
  {
    id: "sustains",
    title: "Sustains",
    summary: "Hold the fret through the tail to collect tick points.",
    instruction:
      "Hit the head, then keep every lane held while the tail passes the line. Letting go ends the ticks but does not break your streak. Star sustains also build meter while you hold W.",
    successHint: "Hit at least one sustain and collect some ticks.",
    difficulty: "medium",
    notes: [
      { time: 4, lanes: [0], duration: 2.4 },
      { time: 8, lanes: [2], duration: 2.8 },
      { time: 12, lanes: [4], duration: 2.2 },
    ],
    palette: {
      primary: "#33f0ff",
      secondary: "#ff3ea5",
      accent: "#c6ff4d",
      glow: "#6ff7ff",
      background: "#040b0f",
      ink: "#ecfeff",
    },
  },
  {
    id: "star",
    title: "Star power",
    summary: "Complete the star phrase, then spend the meter deliberately.",
    instruction:
      "The eight gold notes are a star phrase. Hit the whole run to fill 25% of the meter, then press Q (or Enter) to activate. Star power doubles your multiplier until it expires.",
    successHint: "Fill the meter and activate star power before the lesson ends.",
    difficulty: "medium",
    requiresStarActivation: true,
    notes: [
      { time: 4, lanes: [0], star: true },
      { time: 4.8, lanes: [1], star: true },
      { time: 5.6, lanes: [2], star: true },
      { time: 6.4, lanes: [3], star: true },
      { time: 7.2, lanes: [4], star: true },
      { time: 8, lanes: [3], star: true },
      { time: 8.8, lanes: [2], star: true },
      { time: 9.6, lanes: [1], star: true },
    ],
    palette: {
      primary: "#ffcf4d",
      secondary: "#ff3d6e",
      accent: "#48e5ff",
      glow: "#ffe08a",
      background: "#0b0608",
      ink: "#fff7ee",
    },
  },
  {
    id: "hopo",
    title: "Hammer-ons",
    summary: "Fret a flagged note without strumming after a hit.",
    instruction:
      "HOPOs are marked notes that follow a hit. Keep the previous note hit, then press the new fret without touching the strum bar. Strumming still works, but fretting alone is faster. HOPOs never appear in chords.",
    successHint: "Hit the first note, then at least one HOPO by fretting alone.",
    difficulty: "expert",
    notes: [
      { time: 4, lanes: [0] },
      { time: 4.35, lanes: [1], hopo: true },
      { time: 4.7, lanes: [2], hopo: true },
      { time: 5.05, lanes: [3], hopo: true },
      { time: 6.5, lanes: [1] },
      { time: 6.85, lanes: [2], hopo: true },
      { time: 7.2, lanes: [3], hopo: true },
      { time: 8.8, lanes: [0] },
      { time: 9.15, lanes: [1], hopo: true },
      { time: 9.5, lanes: [2], hopo: true },
    ],
    palette: {
      primary: "#9d8cff",
      secondary: "#64f0d0",
      accent: "#ffd1f0",
      glow: "#beb2ff",
      background: "#050711",
      ink: "#f1efff",
    },
  },
];

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = LESSON_SEEDS.map(buildLesson);

export function tutorialLessonById(id: LessonId): TutorialLesson {
  const found = TUTORIAL_LESSONS.find((lesson) => lesson.id === id);
  const first = TUTORIAL_LESSONS[0];
  if (found) return found;
  if (first) return first;
  throw new Error("Tutorial has no lessons.");
}
