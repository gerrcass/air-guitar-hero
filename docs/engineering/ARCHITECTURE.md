# Architecture

Air Guitar Hero is a static SPA. The playfield is Canvas 2D; the shell is React; audio is
Web Audio; saves are localStorage. The important boundary is between **the game** and
**everything that can fail**: the game is a pure, clock-injected state machine, while
audio, rendering, input devices, and React sit around it.

## Runtime flow

```text
keyboard / gamepad
        │  timestamped input
        ▼
   GameSession ◄──── audio clock (AudioContext.currentTime + calibration)
        │
        ├─ GameSnapshot ──► HighwayRenderer (Canvas, every frame)
        └─ HudSnapshot  ──► React HUD (throttled)
        │
        └─ JudgementEvents ──► audio SFX + particles + haptics
```

One clock source: `AudioEngine.now()` while a run is live. During pause the audio context
is suspended and the session freezes. A manual clock lets tests advance the same engine
without a browser.

## Folder map

```text
src/
├── game/          # pure engine: judgement, scoring, combo, star power, session
├── content/       # song definitions, composer, chart builder, setlist, venues
├── audio/         # synth voices, look-ahead scheduler, buses, SFX
├── render/        # highway renderer, stage backdrop, particles, palettes
├── input/         # keyboard/gamepad binding tables and event normalization
├── state/         # save schema + migrations, career progress, settings, router
├── screens/       # menu, career, quickplay, song select, gameplay, practice,
│                  # tutorial, face-off, results, settings, extras
├── components/    # shell UI: HUD, meters, cards, dialogs, focus rings
└── styles/        # design tokens and global styles
e2e/               # Playwright journeys and visual captures
scripts/           # screenshot capture, asset checks
docs/              # design, ADRs, engineering notes
```

## Data flow for a run

1. The selected `SongDefinition` is composed once into an `Arrangement` (audio events per
   instrument) and one `Chart` per difficulty. Composition is deterministic.
2. `AudioEngine` schedules the arrangement with a look-ahead scheduler and exposes
   `now()` plus pause/resume/seek.
3. `GameSession` is created with the chart, difficulty config, and a clock. It consumes
   input events, emits judgements, and exposes an immutable `GameSnapshot`.
4. The renderer reads snapshots and draws. React reads the HUD snapshot at ~8–12 Hz so the
   HUD never re-renders per frame.
5. Results are computed by pure scoring functions and persisted through the save store.

## Core contracts

The implementation owns exact file names; these shapes are the decisions.

```ts
type Lane = 0 | 1 | 2 | 3 | 4;
type Difficulty = "easy" | "medium" | "hard" | "expert";

interface NoteGroup {
  id: number;
  time: number;          // seconds from song start
  lanes: Lane[];         // 1–3, sorted, unique
  duration: number;      // seconds; 0 for a gem
  star: boolean;         // belongs to a star phrase
  hopo: boolean;         // frettable without strum
}

interface Chart {
  songId: string;
  difficulty: Difficulty;
  notes: NoteGroup[];
  sections: Section[];
  duration: number;
  parScore: number;
}

interface GameSnapshot {
  time: number;
  score: number;
  streak: number;
  multiplier: number;
  rock: number;          // 0..1
  starPower: number;     // 0..1
  starPowerActive: boolean;
  judgeCounts: Record<Judgement, number>;
  noteStates: readonly NoteState[];
  failed: boolean;
  finished: boolean;
}
```

The engine never reads the DOM, storage, or current time directly. All effects are values
returned to the caller.

## Content pipeline

A song is a compact definition (tempo, key, sections, progression, motifs, mix) plus a
deterministic composer. The composer produces:

- an **arrangement**: timed note events for lead, rhythm, bass, drums, pads;
- a **master chart**: the playable lead line with chords and sustains;
- difficulty charts derived by filtering and lane-mapping the master, with par scores.

Because audio and chart come from the same events, sync is structural. No hand-tuned
millisecond offsets, no separate audio files.

## Save schema

One versioned JSON document under `air-guitar-hero.save.v1`:

```ts
interface SaveData {
  version: 1;
  settings: Settings;
  career: Record<Difficulty, CareerProgress>;
  best: Record<string, BestRun>;     // `${songId}:${difficulty}`
  unlockedGuitars: string[];
  stats: { runs: number; notesHit: number; stars: number };
}
```

Loads are validated and migrated; corrupt data falls back to defaults rather than
crashing. Settings changes persist immediately; run results persist on results entry.

## Seams

| Seam | Why it exists | Test style |
| --- | --- | --- |
| `GameSession` | timing, scoring, failures, star power | deterministic fake-clock unit tests |
| Composer/chart builder | content validity and sync | snapshot + invariant tests |
| Save store | migrations, corruption, career rules | pure function tests |
| Audio scheduler | look-ahead correctness | fake-clock unit tests; smoke in browser |
| Screens | user journeys | Playwright + axe on menus |

Prefer testing through these seams over asserting on renderer internals.

## Performance constraints

- Cap device pixel ratio at 2.
- One Canvas, one rAF loop while playing; pause when the tab is hidden.
- Pre-allocate particle pools; no per-frame object churn in the renderer.
- No heavy 3D/audio libraries; Web Audio scheduling is hand-rolled.
- Song data is code; the production bundle target is under 400 kB gzipped, excluding
  fonts.
