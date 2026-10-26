import { describe, expect, it } from "vitest";
import { getComposedSong } from "./composer";
import { isPracticeLoopDue, sliceChartForPractice } from "./practice";

describe("practice slices", () => {
  it("cuts a real section with a pre-roll and shifts both notes and sections", () => {
    const composed = getComposedSong("neon-throttle");
    const chart = composed.charts.medium;
    const section = chart.sections.find((candidate) => candidate.name === "Chorus 1");
    expect(section).toBeDefined();
    if (!section) return;
    const slice = sliceChartForPractice(chart, section, 2.6);
    expect(slice.startSongTime).toBeCloseTo(Math.max(0, section.start - 2.6));
    expect(slice.label).toBe("Chorus 1");
    expect(slice.chart.duration).toBeCloseTo(section.end - slice.startSongTime);
    expect(slice.chart.notes.length).toBeGreaterThan(10);
    expect(slice.chart.notes.every((note) => note.time >= 0)).toBe(true);
    expect(slice.chart.notes.every((note) => note.time < slice.chart.duration)).toBe(true);
    expect(slice.chart.notes[0]?.time).toBeLessThan(2.6);
    expect(slice.chart.parScore).toBeGreaterThan(0);
    let previous = -1;
    for (const note of slice.chart.notes) {
      expect(note.time).toBeGreaterThan(previous);
      previous = note.time;
    }
    expect(slice.chart.sections.some((candidate) => candidate.name === section.name)).toBe(true);
  });

  it("aligns the pre-roll to the song's bar grid and clears star flags before the section", () => {
    const composed = getComposedSong("chrome-cathedral");
    const chart = composed.charts.hard;
    const section = chart.sections.find((candidate) => candidate.name === "Chorus 1");
    if (!section) throw new Error("fixture");
    const beat = 60 / chart.bpm;
    const preRoll = 8 * beat;
    const slice = sliceChartForPractice(chart, section, preRoll);
    expect(slice.startSongTime / beat).toBeCloseTo(Math.round(slice.startSongTime / beat), 5);
    const beforeSection = slice.chart.notes.filter((note) => note.time < preRoll - 0.001);
    expect(beforeSection.every((note) => !note.star)).toBe(true);
  });

  it("handles the first section without going negative", () => {
    const composed = getComposedSong("gutter-halo");
    const chart = composed.charts.easy;
    const first = chart.sections[0];
    expect(first).toBeDefined();
    if (!first) return;
    const slice = sliceChartForPractice(chart, first, 2.6);
    expect(slice.startSongTime).toBe(0);
    expect(slice.chart.notes.every((note) => note.time >= 0)).toBe(true);
  });

  it("identifies the loop boundary one frame before the end", () => {
    expect(isPracticeLoopDue(7.99, 8.1)).toBe(false);
    expect(isPracticeLoopDue(8.04, 8.1)).toBe(true);
    expect(isPracticeLoopDue(8.1, 8.1)).toBe(true);
    expect(isPracticeLoopDue(2.5, 8.1)).toBe(false);
  });

  it("never emits duplicate note ids or unordered times", () => {
    const composed = getComposedSong("the-last-encore");
    for (const section of composed.charts.expert.sections) {
      const slice = sliceChartForPractice(composed.charts.expert, section);
      const ids = new Set(slice.chart.notes.map((note) => note.id));
      expect(ids.size).toBe(slice.chart.notes.length);
      expect(
        slice.chart.notes.every(
          (note, index) => index === 0 || note.time > (slice.chart.notes[index - 1]?.time ?? -1),
        ),
      ).toBe(true);
    }
  });
});
