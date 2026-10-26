import { describe, expect, it } from "vitest";
import { TUTORIAL_LESSONS, tutorialLessonById } from "./tutorial";

describe("tutorial", () => {
  it("ships five lessons in order with distinct instruction", () => {
    expect(TUTORIAL_LESSONS).toHaveLength(5);
    expect(TUTORIAL_LESSONS.map((lesson) => lesson.id)).toEqual([
      "notes",
      "chords",
      "sustains",
      "star",
      "hopo",
    ]);
    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.instruction.length).toBeGreaterThan(40);
      expect(lesson.chart.notes.length).toBeGreaterThan(2);
      expect(lesson.arrangement.events.length).toBeGreaterThan(20);
      expect(lesson.chart.duration).toBe(18);
      expect(tutorialLessonById(lesson.id).id).toBe(lesson.id);
    }
  });

  it("teaches chords with real two-lane groups", () => {
    const chords = tutorialLessonById("chords");
    expect(chords.chart.notes.every((note) => note.lanes.length === 2)).toBe(true);
  });

  it("teaches sustains with held tails", () => {
    const sustains = tutorialLessonById("sustains");
    expect(sustains.chart.notes.every((note) => note.duration > 1)).toBe(true);
  });

  it("uses a contiguous eight-note star phrase and requires activation", () => {
    const star = tutorialLessonById("star");
    expect(star.requiresStarActivation).toBe(true);
    expect(star.chart.notes.filter((note) => note.star)).toHaveLength(8);
    expect(star.chart.notes.every((note) => note.star)).toBe(true);
  });

  it("flags HOPOs only on single notes after a normal note", () => {
    const hopo = tutorialLessonById("hopo");
    expect(hopo.chart.notes.some((note) => note.hopo)).toBe(true);
    expect(hopo.chart.notes.every((note) => !note.hopo || note.lanes.length === 1)).toBe(true);
    expect(hopo.chart.notes[0]?.hopo).toBe(false);
  });

  it("keeps every lesson playable from the start with a count-in lead", () => {
    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.chart.notes[0]?.time).toBeGreaterThanOrEqual(4);
      expect(lesson.chart.notes[lesson.chart.notes.length - 1]?.time).toBeLessThan(
        lesson.chart.duration,
      );
      let previous = -1;
      for (const note of lesson.chart.notes) {
        expect(note.time).toBeGreaterThan(previous);
        previous = note.time;
      }
    }
  });
});
