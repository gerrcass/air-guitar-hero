import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "../game/types";
import { composeSong, getComposedSong, validateChart } from "./composer";
import { SONGS, SONGS_BY_VENUE, VENUES } from "./songs";
import type { SongDefinition } from "./types";

describe("setlist", () => {
  it("ships twelve songs across three venues with four songs each", () => {
    expect(SONGS).toHaveLength(12);
    expect(VENUES).toHaveLength(3);
    expect(new Set(SONGS.map((song) => song.id)).size).toBe(12);
    expect(new Set(SONGS.map((song) => song.title)).size).toBe(12);
    for (const venue of VENUES) {
      expect(SONGS_BY_VENUE[venue.id]).toHaveLength(4);
    }
  });

  it("gives every song a distinct tempo, palette, progression and duration target", () => {
    expect(new Set(SONGS.map((song) => song.bpm)).size).toBeGreaterThanOrEqual(10);
    expect(
      new Set(
        SONGS.map((song) => `${song.progression.join(",")}|${song.chorusProgression.join(",")}`),
      ).size,
    ).toBeGreaterThanOrEqual(6);
    expect(new Set(SONGS.map((song) => song.palette.background)).size).toBe(12);
    for (const song of SONGS) {
      expect(song.targetDuration).toBeGreaterThanOrEqual(90);
      expect(song.targetDuration).toBeLessThanOrEqual(150);
    }
  });
});

describe("composer", () => {
  it("produces valid charts for all 48 song/difficulty combinations", () => {
    const problems: string[] = [];
    for (const song of SONGS) {
      const composed = composeSong(song);
      for (const difficulty of DIFFICULTIES) {
        const chart = composed.charts[difficulty];
        problems.push(...validateChart(chart, song).map((problem) => `${song.id}/${problem}`));
        expect(chart.notes.length).toBeGreaterThan(30);
        expect(chart.duration).toBeCloseTo(composed.arrangement.duration, 3);
      }
    }
    expect(problems).toEqual([]);
  });

  it("regenerates byte-identical charts and arrangements", () => {
    for (const songId of ["neon-throttle", "chrome-cathedral", "the-last-encore"]) {
      const first = getComposedSong(songId);
      const second = composeSong(first.song);
      expect(JSON.stringify(second.charts)).toBe(JSON.stringify(first.charts));
      expect(JSON.stringify(second.arrangement)).toBe(JSON.stringify(first.arrangement));
    }
  });

  it("makes difficulties genuinely different in density and lanes", () => {
    for (const song of SONGS) {
      const { charts } = composeSong(song);
      expect(charts.expert.notes.length).toBeGreaterThan(charts.easy.notes.length);
      expect(charts.hard.notes.length).toBeGreaterThanOrEqual(charts.medium.notes.length);
      expect(charts.medium.notes.length).toBeGreaterThan(charts.easy.notes.length);
      expect(charts.easy.notes.every((note) => note.lanes.length === 1)).toBe(true);
      expect(
        charts.easy.notes.every((note) => note.lanes[0] !== undefined && note.lanes[0] <= 2),
      ).toBe(true);
      expect(charts.medium.notes.every((note) => note.lanes.every((lane) => lane <= 3))).toBe(true);
      expect(charts.hard.notes.every((note) => !note.hopo || note.lanes.length === 1)).toBe(true);
      expect(charts.medium.notes.some((note) => note.hopo)).toBe(false);
      expect(charts.easy.notes.some((note) => note.hopo)).toBe(false);
    }
  });

  it("places four complete star phrases inside sections and sustains exist", () => {
    for (const song of SONGS) {
      const composed = composeSong(song);
      for (const difficulty of DIFFICULTIES) {
        const chart = composed.charts[difficulty];
        const phrases: number[] = [];
        let count = 0;
        for (const note of chart.notes) {
          if (note.star) count += 1;
          else if (count > 0) {
            phrases.push(count);
            count = 0;
          }
        }
        if (count > 0) phrases.push(count);
        expect(phrases.length).toBeGreaterThanOrEqual(3);
        expect(phrases.every((length) => length >= 8 && length <= 16)).toBe(true);
        expect(chart.notes.some((note) => note.duration > 0)).toBe(true);
      }
    }
  });

  it("emits a sorted arrangement whose lead line matches the playable master", () => {
    for (const song of SONGS) {
      const { arrangement, charts } = composeSong(song);
      expect(arrangement.events.length).toBeGreaterThan(200);
      let previous = -1;
      for (const event of arrangement.events) {
        expect(event.time).toBeGreaterThanOrEqual(previous);
        previous = event.time;
        expect(Number.isFinite(event.time)).toBe(true);
      }
      const expertTimes = new Set(charts.expert.notes.map((note) => note.time.toFixed(3)));
      const leadTimes = arrangement.events
        .filter((event) => event.instrument === "lead")
        .map((event) => event.time.toFixed(3));
      expect(leadTimes.every((time) => expertTimes.has(time))).toBe(true);
      const instruments = new Set(arrangement.events.map((event) => event.instrument));
      expect(instruments).toEqual(new Set(["lead", "rhythm", "bass", "pad", "drums"]));
    }
  });

  it("puts HOPO notes in every Hard and Expert chart", () => {
    for (const song of SONGS) {
      const { charts } = composeSong(song);
      for (const difficulty of ["hard", "expert"] as const) {
        expect(
          charts[difficulty].notes.some((note) => note.hopo),
          `${song.title}/${difficulty} HOPO`,
        ).toBe(true);
      }
    }
  });

  it("keeps Easy star phrases at a beginner-readable spacing", () => {
    for (const song of SONGS) {
      const easy = composeSong(song).charts.easy;
      let previousStar: number | null = null;
      for (const note of easy.notes) {
        if (!note.star) {
          previousStar = null;
          continue;
        }
        if (previousStar !== null) {
          expect(note.time - previousStar, `${song.title} Easy star gap`).toBeGreaterThanOrEqual(
            0.15,
          );
        }
        previousStar = note.time;
      }
    }
  });

  it("uses the authored motif so songs are not one rhythmic template", () => {
    const base = SONGS[0];
    if (!base) throw new Error("fixture");
    const allOn: SongDefinition = { ...base, motif: [1, 1, 1, 1, 1, 1, 1, 1] };
    const sparse: SongDefinition = { ...base, motif: [1, 0, 0, 0, 0, 0, 0, 0] };
    const denseTimes = composeSong(allOn).charts.expert.notes.map((note) => note.time);
    const sparseTimes = composeSong(sparse).charts.expert.notes.map((note) => note.time);
    expect(sparseTimes.length).toBeLessThan(denseTimes.length);
    expect(sparseTimes).not.toEqual(denseTimes.slice(0, sparseTimes.length));
  });

  it("keeps every chart's notes playable at the end of the run", () => {
    for (const song of SONGS) {
      const { charts } = composeSong(song);
      for (const difficulty of DIFFICULTIES) {
        const chart = charts[difficulty];
        const last = chart.notes[chart.notes.length - 1];
        expect(last).toBeDefined();
        expect(last?.time).toBeLessThan(chart.duration - 0.1);
        expect(chart.parScore).toBeGreaterThan(0);
      }
    }
  });
});
