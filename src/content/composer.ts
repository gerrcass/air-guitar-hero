import type { Arrangement, AudioEvent, MelodicEvent } from "../audio/types";
import { GOOD_WINDOW, sustainTickSeconds } from "../game/constants";
import type { Chart, Difficulty, Lane, NoteGroup, Section } from "../game/types";
import { DIFFICULTIES } from "../game/types";
import { songById } from "./songs";
import type { ComposedSong, SongDefinition, SongStyle } from "./types";

const SCALES: Readonly<Record<"minor" | "major", readonly number[]>> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

interface PlannedSection {
  readonly id: string;
  readonly name: string;
  readonly role: "intro" | "verse" | "chorus" | "bridge" | "solo" | "outro";
  readonly startBar: number;
  readonly bars: number;
  readonly energy: number;
  readonly start: number;
  readonly end: number;
  readonly progression: readonly number[];
}

interface GeneratedNote {
  time: number;
  lanes: Lane[];
  duration: number;
  star: boolean;
  hopo: boolean;
  midis: number[];
  sustainCandidate: boolean;
}

interface StyleSpec {
  readonly leadTone: "saw" | "square" | "triangle";
  readonly rhythmBeats: readonly number[];
  readonly rhythmDuration: number;
  readonly kick: readonly number[];
  readonly snare: readonly number[];
  readonly hats: "eighths" | "quarters" | "offbeats";
  readonly bassBeats: readonly number[];
  readonly padVelocity: number;
  readonly energyScale: number;
}

const STYLE: Readonly<Record<SongStyle, StyleSpec>> = {
  garage: {
    leadTone: "saw",
    rhythmBeats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    rhythmDuration: 0.18,
    kick: [0, 2, 2.5],
    snare: [1, 3],
    hats: "eighths",
    bassBeats: [0, 1, 2, 3],
    padVelocity: 0.1,
    energyScale: 0.9,
  },
  punk: {
    leadTone: "square",
    rhythmBeats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    rhythmDuration: 0.14,
    kick: [0, 1, 2, 3],
    snare: [1, 3],
    hats: "eighths",
    bassBeats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    padVelocity: 0.06,
    energyScale: 1,
  },
  doom: {
    leadTone: "saw",
    rhythmBeats: [0, 1.5, 2, 3.5],
    rhythmDuration: 0.85,
    kick: [0, 2],
    snare: [1, 3],
    hats: "quarters",
    bassBeats: [0, 1.5, 2, 3.5],
    padVelocity: 0.16,
    energyScale: 0.82,
  },
  synthwave: {
    leadTone: "square",
    rhythmBeats: [0.5, 1.5, 2.5, 3.5],
    rhythmDuration: 0.2,
    kick: [0, 1, 2, 3],
    snare: [1, 3],
    hats: "offbeats",
    bassBeats: [0, 1, 2, 3],
    padVelocity: 0.24,
    energyScale: 0.95,
  },
  electro: {
    leadTone: "square",
    rhythmBeats: [0, 0.5, 1.5, 2, 2.5, 3.5],
    rhythmDuration: 0.16,
    kick: [0, 1, 2, 3],
    snare: [1, 3],
    hats: "eighths",
    bassBeats: [0, 1, 2, 3],
    padVelocity: 0.2,
    energyScale: 1,
  },
  arena: {
    leadTone: "saw",
    rhythmBeats: [0, 1, 2, 3],
    rhythmDuration: 0.45,
    kick: [0, 2, 2.5],
    snare: [1, 3],
    hats: "eighths",
    bassBeats: [0, 1, 2, 3],
    padVelocity: 0.2,
    energyScale: 1.05,
  },
  dream: {
    leadTone: "triangle",
    rhythmBeats: [0, 2],
    rhythmDuration: 1.6,
    kick: [0, 2],
    snare: [1, 3],
    hats: "quarters",
    bassBeats: [0, 2],
    padVelocity: 0.3,
    energyScale: 0.8,
  },
};

const ENERGY_BY_ROLE: Readonly<Record<PlannedSection["role"], number>> = {
  intro: 0.34,
  verse: 0.58,
  chorus: 0.9,
  bridge: 0.48,
  solo: 0.98,
  outro: 0.4,
};

const ROLE_ORDER = [
  "intro",
  "verse",
  "chorus",
  "verse",
  "chorus",
  "bridge",
  "solo",
  "chorus",
  "outro",
] as const;

function scaleInterval(song: SongDefinition, degree: number): number {
  const scale = SCALES[song.mode];
  const normalized = ((degree % 7) + 7) % 7;
  return scale[normalized] ?? 0;
}

function scaleMidi(song: SongDefinition, degree: number, octave = 2): number {
  const octaveOffset = Math.floor(degree / 7) * 12;
  return song.root + octave * 12 + scaleInterval(song, degree) + octaveOffset;
}

function asLane(value: number): Lane {
  const lane = ((value % 5) + 5) % 5;
  return lane as Lane;
}

function allocateBars(weights: readonly number[], totalBars: number): number[] {
  const minimum = 2;
  const extra = Math.max(0, totalBars - weights.length * minimum);
  const sum = weights.reduce((acc, weight) => acc + Math.max(0.01, weight), 0);
  const raw = weights.map((weight) => (Math.max(0.01, weight) / sum) * extra);
  const allocations = raw.map((value) => minimum + Math.floor(value));
  let remaining = totalBars - allocations.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let cursor = 0;
  while (remaining > 0) {
    const entry = order[cursor % order.length];
    if (entry) {
      const current = allocations[entry.index] ?? minimum;
      allocations[entry.index] = current + 1;
      remaining -= 1;
    }
    cursor += 1;
  }
  return allocations;
}

function planSections(song: SongDefinition): {
  sections: PlannedSection[];
  totalBars: number;
  barSeconds: number;
  duration: number;
} {
  const beatSeconds = 60 / song.bpm;
  const barSeconds = beatSeconds * 4;
  const rawBars = Math.round((song.targetDuration * song.bpm) / 240);
  const totalBars = Math.max(24, Math.min(96, Math.round(rawBars / 4) * 4));
  const weights = ROLE_ORDER.map((role) => {
    const configured = song.sectionWeights.find((section) => section.role === role);
    return configured?.weight ?? 6;
  });
  const allocations = allocateBars(weights, totalBars);
  const roleCounts = new Map<string, number>();
  const sections: PlannedSection[] = [];
  let cursor = 0;
  for (let i = 0; i < ROLE_ORDER.length; i += 1) {
    const role = ROLE_ORDER[i];
    if (!role) continue;
    const bars = allocations[i] ?? 2;
    const count = (roleCounts.get(role) ?? 0) + 1;
    roleCounts.set(role, count);
    const label = role.charAt(0).toUpperCase() + role.slice(1);
    const name = role === "verse" || role === "chorus" ? `${label} ${count}` : label;
    const start = cursor * barSeconds;
    const end = (cursor + bars) * barSeconds;
    const progression =
      role === "chorus" || role === "solo"
        ? song.chorusProgression
        : role === "bridge"
          ? song.bridgeProgression
          : song.progression;
    sections.push({
      id: `${role}-${count}`,
      name,
      role,
      startBar: cursor,
      bars,
      energy: Math.min(1, ENERGY_BY_ROLE[role] * (song.style === "arena" ? 1.04 : 1)),
      start,
      end,
      progression,
    });
    cursor += bars;
  }
  return { sections, totalBars, barSeconds, duration: totalBars * barSeconds };
}

function slotActive(section: PlannedSection, bar: number, slot: number, slots: number): boolean {
  if (slots === 16) {
    const phraseSlot = Math.floor(slot / 2);
    const strong = slot % 4 === 0;
    const pickup = slot % 4 === 3;
    return strong || pickup || (phraseSlot % 2 === 0 && slot % 2 === 1);
  }
  if (section.role === "intro") {
    return slot === 0 || slot === 2 || slot === 3 || slot === 5 || slot === 6;
  }
  if (section.role === "outro") {
    return slot === 0 && bar % 4 !== 3 ? true : slot === 4 && bar % 2 === 0;
  }
  if (section.role === "bridge") {
    return slot % 2 === 0 && (slot === 0 || slot === 2 || slot === 6);
  }
  if (section.role === "chorus") {
    return slot === 0 || slot === 4 || slot === 2 || slot === 6;
  }
  return slot === 0 || slot === 1 || slot === 3 || slot === 4 || slot === 6;
}

function generateMaster(song: SongDefinition): {
  notes: GeneratedNote[];
  sections: PlannedSection[];
  totalBars: number;
  barSeconds: number;
  beatSeconds: number;
  duration: number;
} {
  const plan = planSections(song);
  const beatSeconds = 60 / song.bpm;
  const notes: GeneratedNote[] = [];

  for (const section of plan.sections) {
    const progression = section.progression;
    for (let bar = 0; bar < section.bars; bar += 1) {
      if (section.role === "intro" && bar < 2) continue;
      const chordDegree = progression[bar % progression.length] ?? 0;
      const barStart = section.start + bar * plan.barSeconds;
      const slots = section.role === "solo" || section.role === "chorus" ? 16 : 8;
      const step = plan.barSeconds / slots;
      const lastBar = bar === section.bars - 1;
      for (let slot = 0; slot < slots; slot += 1) {
        let active = slotActive(section, bar, slot, slots);
        if (lastBar && section.role !== "outro" && slot === slots - 2) active = true;
        if (!active) continue;
        const contourIndex = (slot + bar * 2) % song.contour.length;
        const contour = song.contour[contourIndex] ?? 0;
        const melodyDegree = chordDegree + contour;
        const melodyLane = asLane(melodyDegree + song.laneBias);
        const lanes = new Set<Lane>([melodyLane]);
        const chordHere =
          slot === 0 &&
          ((section.role === "chorus" && bar % 2 === 0) ||
            (section.role === "solo" && bar % 4 === 0) ||
            (section.role === "outro" && bar === section.bars - 1));
        if (chordHere && !lastBar) {
          lanes.add(asLane(melodyDegree + 2 + song.laneBias));
          if (section.role === "chorus" && bar % 8 === 6) {
            lanes.add(asLane(melodyDegree + 4 + song.laneBias));
          }
        }
        const sortedLanes = [...lanes].sort((a, b) => a - b);
        const midis = sortedLanes.map((_lane, index) => {
          const base = scaleMidi(song, melodyDegree, 2);
          if (index === 0) return base;
          if (index === 1) return base + (song.mode === "minor" ? 3 : 4);
          return base + 7;
        });
        const sustainCandidate =
          section.role !== "solo" &&
          slot === slots - 2 &&
          bar % 4 === 3 &&
          sortedLanes.length === 1;
        notes.push({
          time: barStart + slot * step,
          lanes: sortedLanes,
          duration: 0,
          star: false,
          hopo: false,
          midis,
          sustainCandidate,
        });
      }
    }
  }

  notes.sort((a, b) => a.time - b.time);

  // Sustains: extend selected single notes up to the next note, then let star phrases
  // force a singable tail at their end.
  for (let i = 0; i < notes.length; i += 1) {
    const note = notes[i];
    const next = notes[i + 1];
    if (!note || !next) continue;
    if (!note.sustainCandidate || note.lanes.length !== 1) continue;
    const maxDuration = Math.min(beatSeconds * 1.5, next.time - note.time - 0.06);
    if (maxDuration >= 0.35) note.duration = maxDuration;
  }

  // Fallback: any single note before a clear gap becomes a musical tail. This keeps every
  // difficulty expressive even when a song's phrase endings land on chords.
  let guaranteedSustains = 0;
  for (let i = 0; i < notes.length - 1 && guaranteedSustains < 8; i += 1) {
    const note = notes[i];
    const next = notes[i + 1];
    if (!note || !next || note.duration > 0 || note.lanes.length !== 1) continue;
    const available = next.time - note.time - 0.06;
    if (available < 0.35) continue;
    note.duration = Math.min(beatSeconds * 1.5, available);
    guaranteedSustains += 1;
  }

  // Star phrases live inside choruses and the solo, ten to twelve groups long.
  for (const section of plan.sections) {
    if (section.role !== "chorus" && section.role !== "solo") continue;
    const indices = notes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => note.time >= section.start && note.time < section.end)
      .map(({ index }) => index);
    if (indices.length < 10) continue;
    const length = section.role === "solo" ? 12 : 10;
    const start = Math.min(
      indices.length - length,
      Math.floor(indices.length * (section.role === "solo" ? 0.38 : 0.3)),
    );
    const chosen = indices.slice(start, start + length);
    for (const index of chosen) {
      const note = notes[index];
      if (note) note.star = true;
    }
    const lastIndex = chosen[chosen.length - 1];
    const last = lastIndex === undefined ? undefined : notes[lastIndex];
    const after = lastIndex === undefined ? undefined : notes[lastIndex + 1];
    if (last && after) {
      const lengthToNext = after.time - last.time - 0.06;
      if (lengthToNext >= 0.5) last.duration = Math.max(last.duration, Math.min(1.1, lengthToNext));
    }
  }

  // Guarantee sustains in every song and difficulty: extend the final note of each
  // four-bar block when the next note leaves room for a tail.
  for (const section of plan.sections) {
    for (let bar = 3; bar < section.bars; bar += 4) {
      const barStart = section.start + bar * plan.barSeconds;
      const barEnd = barStart + plan.barSeconds;
      let candidateIndex = -1;
      for (let i = 0; i < notes.length; i += 1) {
        const note = notes[i];
        if (!note || note.time < barStart) continue;
        if (note.time >= barEnd) break;
        if (note.lanes.length === 1) candidateIndex = i;
      }
      if (candidateIndex < 0) continue;
      const note = notes[candidateIndex];
      const after = notes[candidateIndex + 1];
      if (!note || !after || note.duration > 0) continue;
      const available = after.time - note.time - 0.06;
      if (available >= 0.4) note.duration = Math.min(beatSeconds * 1.5, available);
    }
  }

  return {
    notes,
    sections: plan.sections,
    totalBars: plan.totalBars,
    barSeconds: plan.barSeconds,
    beatSeconds,
    duration: plan.duration,
  };
}

function shouldKeep(note: GeneratedNote, index: number, difficulty: Difficulty): boolean {
  if (note.star || note.duration > 0) return true;
  switch (difficulty) {
    case "easy":
      return index % 3 === 0;
    case "medium":
      return index % 2 === 0;
    case "hard":
      return index % 8 !== 7;
    case "expert":
      return true;
  }
}

function mapLanes(lanes: readonly Lane[], difficulty: Difficulty): Lane[] {
  if (difficulty === "easy") {
    const lane = lanes[0] ?? 0;
    return [asLane(lane % 3)];
  }
  if (difficulty === "medium") {
    const mapped = new Set<Lane>();
    for (const lane of lanes.slice(0, 2)) mapped.add(asLane(lane % 4));
    return [...mapped].sort((a, b) => a - b);
  }
  return [...lanes].sort((a, b) => a - b);
}

function recomputeHopo(notes: NoteGroup[], difficulty: Difficulty, bpm: number): NoteGroup[] {
  const beat = 60 / bpm;
  const threshold = Math.min(0.18, beat / 3);
  if (difficulty === "easy" || difficulty === "medium") {
    return notes.map((note) => ({ ...note, hopo: false }));
  }
  return notes.map((note, index) => {
    const previous = notes[index - 1];
    if (!previous || previous.lanes.length > 1 || note.lanes.length > 1) {
      return { ...note, hopo: false };
    }
    const gap = note.time - previous.time;
    return { ...note, hopo: gap >= 0.075 && gap <= threshold };
  });
}

function calculatePar(notes: readonly NoteGroup[], bpm: number): number {
  const gemCount = notes.reduce((sum, note) => sum + note.lanes.length, 0);
  const tickSeconds = sustainTickSeconds(bpm);
  const estimatedTicks = notes.reduce(
    (sum, note) => sum + (note.duration > 0 ? Math.floor(note.duration / tickSeconds) : 0),
    0,
  );
  return Math.max(1, Math.round(gemCount * 50 * 2.6 + estimatedTicks * 30 + notes.length * 5));
}

function buildChart(
  song: SongDefinition,
  master: readonly GeneratedNote[],
  sections: readonly PlannedSection[],
  difficulty: Difficulty,
  duration: number,
): Chart {
  const kept = master
    .map((note, index) => ({ note, index }))
    .filter(({ note, index }) => shouldKeep(note, index, difficulty));
  const baseNotes: NoteGroup[] = kept.map(({ note }, index) => ({
    id: index,
    time: Math.round(note.time * 1000) / 1000,
    lanes: mapLanes(note.lanes, difficulty),
    duration: Math.round(note.duration * 1000) / 1000,
    star: note.star,
    hopo: note.hopo,
  }));
  const notes = recomputeHopo(baseNotes, difficulty, song.bpm);
  const chartSections: Section[] = sections.map((section) => ({
    id: section.id,
    name: section.name,
    start: Math.round(section.start * 1000) / 1000,
    end: Math.round(section.end * 1000) / 1000,
  }));
  return {
    songId: song.id,
    difficulty,
    notes,
    sections: chartSections,
    duration: Math.round(duration * 1000) / 1000,
    parScore: calculatePar(notes, song.bpm),
    bpm: song.bpm,
  };
}

function leadEvents(song: SongDefinition, master: readonly GeneratedNote[]): MelodicEvent[] {
  const style = STYLE[song.style];
  return master.flatMap((note) =>
    note.midis.map((midi) => ({
      instrument: "lead" as const,
      time: note.time,
      duration: note.duration > 0 ? note.duration : Math.max(0.11, 0.4 * style.rhythmDuration),
      midi,
      velocity: note.star ? 0.95 : 0.72 + song.difficultyRating * 0.015,
    })),
  );
}

function backingEvents(
  song: SongDefinition,
  sections: readonly PlannedSection[],
  barSeconds: number,
): AudioEvent[] {
  const style = STYLE[song.style];
  const beatSeconds = barSeconds / 4;
  const events: AudioEvent[] = [];
  for (const section of sections) {
    for (let bar = 0; bar < section.bars; bar += 1) {
      const chordDegree = section.progression[bar % section.progression.length] ?? 0;
      const barStart = section.start + bar * barSeconds;
      const energy = section.energy;
      const lastBar = bar === section.bars - 1;

      // Pad: one sustained chord per bar, heavier in synth and dream styles.
      for (const interval of [0, 2, 4]) {
        events.push({
          instrument: "pad",
          time: barStart,
          duration: barSeconds * 0.97,
          midi: scaleMidi(song, chordDegree + interval, 2),
          velocity: style.padVelocity * (0.8 + energy * 0.4),
        });
      }

      // Rhythm guitar: power chords, style-specific pattern.
      for (const beat of style.rhythmBeats) {
        events.push({
          instrument: "rhythm",
          time: barStart + beat * beatSeconds,
          duration: style.rhythmDuration,
          midi: scaleMidi(song, chordDegree, 1),
          velocity: 0.34 + energy * 0.34,
        });
        events.push({
          instrument: "rhythm",
          time: barStart + beat * beatSeconds,
          duration: style.rhythmDuration,
          midi: scaleMidi(song, chordDegree, 1) + 7,
          velocity: 0.3 + energy * 0.3,
        });
      }

      // Bass follows the kick pattern with occasional octave passing tones.
      for (const beat of style.bassBeats) {
        events.push({
          instrument: "bass",
          time: barStart + beat * beatSeconds,
          duration: Math.min(beatSeconds * 0.9, barSeconds * 0.4),
          midi: song.root + scaleInterval(song, chordDegree),
          velocity: 0.55 + energy * 0.25,
        });
      }

      // Drums.
      for (const beat of style.kick) {
        events.push({
          instrument: "drums",
          time: barStart + beat * beatSeconds,
          drum: "kick",
          velocity: 0.9,
        });
      }
      for (const beat of style.snare) {
        events.push({
          instrument: "drums",
          time: barStart + beat * beatSeconds,
          drum: "snare",
          velocity: 0.7 + energy * 0.2,
        });
      }
      const hats: number[] =
        style.hats === "eighths"
          ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
          : style.hats === "offbeats"
            ? [0.5, 1.5, 2.5, 3.5]
            : [0, 1, 2, 3];
      for (const beat of hats) {
        events.push({
          instrument: "drums",
          time: barStart + beat * beatSeconds,
          drum: beat === 3.5 && song.style !== "doom" ? "open-hat" : "hat",
          velocity: 0.22 + energy * 0.2,
        });
      }
      if (bar === 0 && (section.role === "chorus" || section.role === "solo")) {
        events.push({
          instrument: "drums",
          time: barStart,
          drum: "crash",
          velocity: 0.8,
        });
      }
      if (bar === 0 && section.role === "intro") {
        events.push({ instrument: "drums", time: barStart, drum: "crash", velocity: 0.55 });
      }
      if (lastBar && section.role !== "outro") {
        for (const beat of [3.5, 3.75]) {
          events.push({
            instrument: "drums",
            time: barStart + beat * beatSeconds,
            drum: "snare",
            velocity: 0.55 + energy * 0.2,
          });
        }
      }
    }
  }
  return events;
}

const INSTRUMENT_ORDER: Readonly<Record<AudioEvent["instrument"], number>> = {
  drums: 0,
  bass: 1,
  rhythm: 2,
  pad: 3,
  lead: 4,
};

export function composeSong(song: SongDefinition): ComposedSong {
  const master = generateMaster(song);
  const charts = {} as Record<Difficulty, Chart>;
  for (const difficulty of DIFFICULTIES) {
    charts[difficulty] = buildChart(
      song,
      master.notes,
      master.sections,
      difficulty,
      master.duration,
    );
  }
  const style = STYLE[song.style];
  const events: AudioEvent[] = [
    ...leadEvents(song, master.notes),
    ...backingEvents(song, master.sections, master.barSeconds),
  ];
  events.sort(
    (a, b) => a.time - b.time || INSTRUMENT_ORDER[a.instrument] - INSTRUMENT_ORDER[b.instrument],
  );
  const arrangement: Arrangement = {
    songId: song.id,
    bpm: song.bpm,
    duration: master.duration,
    style: song.style,
    leadTone: style.leadTone,
    events,
  };
  return { song, arrangement, charts };
}

const cache = new Map<string, ComposedSong>();

export function getComposedSong(songId: string): ComposedSong {
  const cached = cache.get(songId);
  if (cached) return cached;
  const composed = composeSong(songById(songId));
  cache.set(songId, composed);
  return composed;
}

export function clearCompositionCache(): void {
  cache.clear();
}

export function validateChart(chart: Chart, song: SongDefinition): string[] {
  const problems: string[] = [];
  const goodWindow = GOOD_WINDOW[chart.difficulty];
  let previousTime = -1;
  let starRunEnd = -1;
  for (let i = 0; i < chart.notes.length; i += 1) {
    const note = chart.notes[i];
    if (!note) continue;
    if (!(note.time > previousTime)) problems.push(`${chart.difficulty}: note ${i} not increasing`);
    previousTime = note.time;
    if (note.time > chart.duration + 0.001)
      problems.push(`${chart.difficulty}: note ${i} past end`);
    if (note.lanes.length < 1 || note.lanes.length > 3) {
      problems.push(`${chart.difficulty}: note ${i} has ${note.lanes.length} lanes`);
    }
    if (new Set(note.lanes).size !== note.lanes.length) {
      problems.push(`${chart.difficulty}: note ${i} duplicate lane`);
    }
    if (note.lanes.some((lane) => lane < 0 || lane > 4)) {
      problems.push(`${chart.difficulty}: note ${i} lane out of range`);
    }
    if (chart.difficulty === "easy" && (note.lanes.length !== 1 || note.lanes.some((l) => l > 2))) {
      problems.push(`${chart.difficulty}: note ${i} violates easy lane rules`);
    }
    if (chart.difficulty === "medium" && note.lanes.some((lane) => lane > 3)) {
      problems.push(`${chart.difficulty}: note ${i} uses a lane outside 0–3`);
    }
    if (note.hopo && note.lanes.length > 1) {
      problems.push(`${chart.difficulty}: note ${i} HOPO on a chord`);
    }
    if (note.duration < 0) problems.push(`${chart.difficulty}: note ${i} negative duration`);
    if (note.star && i > starRunEnd) {
      // Start of a star run; collect its extent and validate.
      let end = i;
      while (chart.notes[end + 1]?.star) end += 1;
      const length = end - i + 1;
      if (length < 8 || length > 16) {
        problems.push(`${chart.difficulty}: star phrase at ${i} has length ${length}`);
      }
      const section = chart.sections.find((s) => note.time >= s.start && note.time < s.end);
      const endNote = chart.notes[end];
      if (!section || !endNote || endNote.time >= section.end) {
        problems.push(`${chart.difficulty}: star phrase at ${i} crosses a section`);
      }
      starRunEnd = end;
    }
    if (!Number.isFinite(note.time) || !Number.isFinite(note.duration)) {
      problems.push(`${chart.difficulty}: note ${i} has non-finite time`);
    }
  }
  if (chart.parScore <= 0) problems.push(`${chart.difficulty}: par score not positive`);
  if (chart.duration < 90 || chart.duration > 150) {
    problems.push(`${chart.difficulty}: duration ${chart.duration} outside 90–150s`);
  }
  if (song.id !== chart.songId) problems.push(`${chart.difficulty}: song id mismatch`);
  // Ensure the last note is inside the final window so a run can finish cleanly.
  const last = chart.notes[chart.notes.length - 1];
  if (last && last.time + goodWindow > chart.duration) {
    problems.push(`${chart.difficulty}: last note is too close to the end`);
  }
  return problems;
}
