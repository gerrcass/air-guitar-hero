import { sustainTickSeconds } from "../game/constants";
import type { Chart, Section } from "../game/types";

export interface PracticeSlice {
  readonly chart: Chart;
  readonly section: Section;
  /** Song time where the practice slice (and its audio) begins. */
  readonly startSongTime: number;
  readonly label: string;
}

function calculatePar(notes: Chart["notes"], bpm: number): number {
  const gems = notes.reduce((sum, note) => sum + note.lanes.length, 0);
  const tick = sustainTickSeconds(bpm);
  const ticks = notes.reduce(
    (sum, note) => sum + (note.duration > 0 ? Math.floor(note.duration / tick) : 0),
    0,
  );
  return Math.max(1, Math.round(gems * 50 * 2.6 + ticks * 30 + notes.length * 5));
}

/** True when a looping practice chart has reached its restart boundary. */
export function isPracticeLoopDue(time: number, duration: number): boolean {
  return time >= duration - 0.06;
}

/**
 * Slice a real chart to a practice section, shifted so the section begins at a small
 * pre-roll offset. This gives gems time to travel the highway after the count-in while the
 * audio starts at the same song time.
 */
export function sliceChartForPractice(
  chart: Chart,
  section: Section,
  preRollSeconds = 2.6,
): PracticeSlice {
  const beat = 60 / chart.bpm;
  const rawStart = Math.max(0, section.start - preRollSeconds);
  const startSongTime =
    Math.abs(preRollSeconds / beat - Math.round(preRollSeconds / beat)) < 0.0001
      ? Math.max(0, Math.round(rawStart / beat) * beat)
      : rawStart;
  const shift = startSongTime;
  const duration = Math.max(0.5, section.end - startSongTime);
  const notes = chart.notes
    .filter((note) => note.time >= startSongTime && note.time < section.end)
    .map((note, index) => ({
      ...note,
      id: index,
      time: Math.round((note.time - shift) * 1000) / 1000,
      duration: Math.round(note.duration * 1000) / 1000,
      star: note.star && note.time >= section.start,
    }));
  const sections = chart.sections
    .filter((candidate) => candidate.end > startSongTime && candidate.start < section.end)
    .map((candidate) => ({
      ...candidate,
      start: Math.max(0, Math.round((candidate.start - shift) * 1000) / 1000),
      end: Math.min(duration, Math.round((candidate.end - shift) * 1000) / 1000),
    }));
  const practiceChart: Chart = {
    ...chart,
    notes,
    sections,
    duration: Math.round(duration * 1000) / 1000,
    parScore: calculatePar(notes, chart.bpm),
  };
  return {
    chart: practiceChart,
    section,
    startSongTime,
    label: section.name,
  };
}
