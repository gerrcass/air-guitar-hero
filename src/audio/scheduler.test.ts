import { describe, expect, it } from "vitest";
import { EventScheduler } from "./scheduler";
import { stretchDuration } from "./synth";
import type { AudioEvent } from "./types";

function note(time: number, midi = 60): AudioEvent {
  return { instrument: "lead", time, duration: 0.2, midi, velocity: 0.8 };
}

describe("playback stretching", () => {
  it("stretches note durations with the same tempo factor as start times", () => {
    expect(stretchDuration(2, 1)).toBe(2);
    expect(stretchDuration(2, 0.5)).toBe(4);
    expect(stretchDuration(2, 0.75)).toBeCloseTo(2.6667, 3);
  });
});

describe("EventScheduler", () => {
  it("emits each event once, in order, within the look-ahead horizon", () => {
    const scheduler = new EventScheduler([note(0), note(1), note(2)], 0.5);
    scheduler.start(100, 0, 1);
    expect(scheduler.due(100).map((entry) => entry.event.time)).toEqual([0]);
    expect(scheduler.due(100.2).map((entry) => entry.event.time)).toEqual([]);
    expect(scheduler.due(100.6).map((entry) => entry.event.time)).toEqual([1]);
    expect(scheduler.due(101.2).map((entry) => entry.event.time)).toEqual([]);
    expect(scheduler.due(102).map((entry) => entry.event.time)).toEqual([2]);
    expect(scheduler.due(103)).toEqual([]);
    expect(scheduler.scheduledCount).toBe(3);
    expect(scheduler.finished).toBe(true);
  });

  it("maps chart time to context time with the practice speed", () => {
    const scheduler = new EventScheduler([note(0), note(1), note(2)], 0.2);
    scheduler.start(50, 0, 0.5);
    const first = scheduler.due(50);
    expect(first[0]?.when).toBeCloseTo(50);
    const second = scheduler.due(52);
    expect(second[0]?.when).toBeCloseTo(52);
    const third = scheduler.due(54);
    expect(third[0]?.when).toBeCloseTo(54);
  });

  it("starts from a section offset without replaying earlier events", () => {
    const scheduler = new EventScheduler([note(0), note(1), note(2)], 0.25);
    scheduler.start(10, 1.5, 1);
    expect(scheduler.due(10.5).map((entry) => entry.event.time)).toEqual([2]);
    expect(scheduler.due(10.7)).toEqual([]);
  });

  it("does not schedule before a count-in origin has arrived", () => {
    const scheduler = new EventScheduler([note(0), note(0.1)], 0.2);
    scheduler.start(20, 0, 1);
    const due = scheduler.due(18);
    expect(due.map((entry) => entry.when)).toEqual([20, 20.1]);
    expect(due.every((entry) => entry.when > 18)).toBe(true);
  });
});
