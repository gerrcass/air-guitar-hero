import { describe, expect, it } from "vitest";
import { GameSession } from "./session";
import type { Chart, Difficulty, Lane, NoteGroup, SessionOptions } from "./types";

const MEDIUM_GOOD = 0.15;

function note(
  id: number,
  time: number,
  lanes: readonly Lane[],
  extra: Partial<Pick<NoteGroup, "duration" | "star" | "hopo">> = {},
): NoteGroup {
  return {
    id,
    time,
    lanes,
    duration: extra.duration ?? 0,
    star: extra.star ?? false,
    hopo: extra.hopo ?? false,
  };
}

function chart(notes: readonly NoteGroup[], overrides: Partial<Omit<Chart, "notes">> = {}): Chart {
  return {
    songId: "test-song",
    difficulty: "medium",
    notes,
    sections: [{ id: "s1", name: "Verse", start: 0, end: 60 }],
    duration: overrides.duration ?? 60,
    parScore: 1000,
    bpm: 120,
    ...overrides,
  };
}

function session(
  notes: readonly NoteGroup[],
  options: Partial<SessionOptions> = {},
  overrides: Partial<Omit<Chart, "notes">> = {},
) {
  return new GameSession(chart(notes, overrides), {
    difficulty: (overrides.difficulty as Difficulty | undefined) ?? "medium",
    ...options,
  });
}

function hit(s: GameSession, time: number, lanes: readonly Lane[] = [0]): void {
  for (const lane of lanes) s.pressFret(lane, time);
  s.strum(time);
}

describe("GameSession judgement", () => {
  it("scores a gem hit inside the perfect window and counts one note", () => {
    const s = session([note(0, 5, [0])]);
    s.pressFret(0, 4.99);
    const events = s.strum(5);

    expect(events).toContainEqual(
      expect.objectContaining({ type: "judgement", judgement: "perfect", points: 50 }),
    );
    const snap = s.snapshot();
    expect(snap.score).toBe(50);
    expect(snap.streak).toBe(1);
    expect(snap.judgeCounts.perfect).toBe(1);
    expect(snap.noteStates[0]?.status).toBe("hit");
  });

  it("grades early and late hits by the same ladder", () => {
    const s = session([note(0, 5, [0]), note(1, 6, [0]), note(2, 7, [0])]);
    hit(s, 5.02);
    hit(s, 6.06);
    hit(s, 6.86);
    expect(s.snapshot().judgeCounts).toMatchObject({ perfect: 1, great: 1, good: 1 });
  });

  it("misses a note once its window closes and consumes it once", () => {
    const s = session([note(0, 5, [0])]);
    s.update(5 + MEDIUM_GOOD + 0.001);
    expect(s.snapshot().judgeCounts.miss).toBe(1);
    expect(s.snapshot().noteStates[0]?.status).toBe("missed");
    const before = s.snapshot().score;
    s.update(20);
    hit(s, 20);
    expect(s.snapshot().judgeCounts.miss).toBe(1);
    expect(s.snapshot().score).toBe(before);
  });

  it("penalises a strum with no eligible note as an overstrum", () => {
    const s = session([note(0, 5, [0])]);
    const events = s.strum(2);
    expect(events).toContainEqual(expect.objectContaining({ type: "overstrum" }));
    expect(s.snapshot().streak).toBe(0);
    expect(s.snapshot().rock).toBeLessThan(0.64);
  });

  it("consumes the earliest eligible note when two windows overlap", () => {
    const s = session([note(0, 5, [0]), note(1, 5.1, [0])]);
    s.pressFret(0, 5.06);
    const events = s.strum(5.06);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "judgement", noteId: 0, judgement: "great" }),
    );
    expect(s.snapshot().noteStates[0]?.status).toBe("hit");
    expect(s.snapshot().noteStates[1]?.status).toBe("pending");
    s.strum(5.1);
    expect(s.snapshot().noteStates[1]?.status).toBe("hit");
  });

  it("leaves previously returned snapshots immutable", () => {
    const s = session([note(0, 5, [0])]);
    const before = s.snapshot();
    hit(s, 5);
    expect(before.noteStates[0]?.status).toBe("pending");
    expect(s.snapshot().noteStates[0]?.status).toBe("hit");
  });

  it("does not score the same note twice", () => {
    const s = session([note(0, 5, [0])]);
    hit(s, 5);
    const seconds = s.strum(5.01);
    expect(seconds).toContainEqual(expect.objectContaining({ type: "overstrum" }));
    expect(s.snapshot().score).toBe(50);
  });
});

describe("GameSession multiplier and accuracy", () => {
  it("steps the multiplier at streaks 10, 20 and 30 and applies it to the triggering note", () => {
    const notes = Array.from({ length: 12 }, (_, i) => note(i, 1 + i, [0]));
    const s = session(notes);
    for (let i = 0; i < 12; i += 1) {
      hit(s, notes[i]?.time ?? 0);
      s.releaseFret(0, (notes[i]?.time ?? 0) + 0.01);
    }
    const snap = s.snapshot();
    expect(snap.streak).toBe(12);
    expect(snap.baseMultiplier).toBe(2);
    expect(snap.multiplier).toBe(2);
    expect(snap.score).toBe(9 * 50 + 3 * 100);
  });

  it("reports weighted accuracy over judged note groups", () => {
    const s = session([note(0, 1, [0]), note(1, 2, [0]), note(2, 3, [0]), note(3, 20, [0])]);
    hit(s, 1);
    s.releaseFret(0, 1.01);
    hit(s, 2.03);
    s.releaseFret(0, 2.04);
    s.update(3.2);
    expect(s.snapshot().accuracy).toBeCloseTo((1 + 1 + 0) / 3, 5);
    expect(s.snapshot().judgeCounts.miss).toBe(1);
  });
});

describe("chords", () => {
  it("requires every lane held and scores each gem while counting one streak", () => {
    const s = session([note(0, 5, [0, 2])]);
    s.pressFret(0, 5);
    s.strum(5);
    expect(s.snapshot().judgeCounts.miss).toBe(0);
    expect(s.snapshot().score).toBe(0);

    s.pressFret(2, 5.001);
    const events = s.strum(5.002);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "judgement",
        judgement: "perfect",
        points: 100,
        gemCount: 2,
      }),
    );
    expect(s.snapshot().streak).toBe(1);
    expect(s.snapshot().score).toBe(100);
  });

  it("misses a partially held chord when the window closes", () => {
    const s = session([note(0, 5, [0, 2])]);
    s.pressFret(0, 5);
    s.strum(5);
    s.update(5.2);
    expect(s.snapshot().judgeCounts.miss).toBe(1);
    expect(s.snapshot().score).toBe(0);
  });
});

describe("sustains", () => {
  it("ticks while held and stops when released without breaking the streak", () => {
    const s = session([note(0, 5, [0], { duration: 2 })]);
    hit(s, 5);
    s.update(5.6);
    const afterTicks = s.snapshot();
    expect(afterTicks.sustainTicks).toBe(2);
    expect(afterTicks.score).toBe(70);
    expect(afterTicks.noteStates[0]?.status).toBe("holding");

    s.releaseFret(0, 5.7);
    expect(s.snapshot().noteStates[0]?.status).toBe("released");
    s.update(6.6);
    expect(s.snapshot().sustainTicks).toBe(2);
    expect(s.snapshot().streak).toBe(1);
    expect(s.snapshot().score).toBe(70);
  });
});

describe("star power", () => {
  it("fills a quarter meter for each completed star phrase", () => {
    const notes = Array.from({ length: 8 }, (_, i) => note(i, 1 + i, [0], { star: true }));
    const s = session(notes);
    for (let i = 0; i < 8; i += 1) {
      hit(s, notes[i]?.time ?? 0);
      s.releaseFret(0, (notes[i]?.time ?? 0) + 0.02);
    }
    expect(s.snapshot().starPower).toBeCloseTo(0.25, 5);
    expect(s.snapshot().judgeCounts.perfect).toBe(8);
  });

  it("activates at 25%, consumes the meter and doubles the multiplier for 32 beats", () => {
    const notes = Array.from({ length: 8 }, (_, i) => note(i, 1 + i, [0], { star: true }));
    const s = session(notes);
    for (let i = 0; i < 8; i += 1) {
      hit(s, notes[i]?.time ?? 0);
      s.releaseFret(0, (notes[i]?.time ?? 0) + 0.02);
    }
    const events = s.activateStarPower(9);
    expect(events).toContainEqual(expect.objectContaining({ type: "starPowerActivated" }));
    expect(s.snapshot().starPowerActive).toBe(true);
    expect(s.snapshot().multiplier).toBe(2);
    expect(s.snapshot().starPower).toBe(0);

    s.update(24.9);
    expect(s.snapshot().starPowerActive).toBe(true);
    s.update(25);
    expect(s.snapshot().starPowerActive).toBe(false);
    expect(s.snapshot().multiplier).toBe(1);
  });

  it("rejects activation below 25% and after failure", () => {
    const s = session([note(0, 1, [0])]);
    expect(s.activateStarPower(0.5)).toEqual([]);
    expect(s.snapshot().starPowerActive).toBe(false);

    const failing = session(Array.from({ length: 14 }, (_, index) => note(index, index + 1, [0])));
    failing.update(30);
    expect(failing.snapshot().failed).toBe(true);
    expect(failing.activateStarPower(31)).toEqual([]);
  });

  it("fills the meter with four completed star phrases", () => {
    const notes = Array.from({ length: 32 }, (_, index) =>
      note(index, 1 + index * 0.5, [(index % 5) as Lane], { star: true }),
    );
    // Break the star runs into four phrases of eight with non-star spacers.
    const withSpacers = notes.flatMap((entry, index) => {
      if (index > 0 && index % 8 === 0) {
        return [{ ...note(1000 + index, entry.time - 0.05, [0]), star: false }, entry];
      }
      return [entry];
    });
    const s = session(withSpacers);
    for (const entry of withSpacers) {
      if (entry.star) {
        hit(s, entry.time, entry.lanes);
        for (const lane of entry.lanes) s.releaseFret(lane, entry.time + 0.01);
      }
    }
    expect(s.snapshot().starPower).toBeCloseTo(1, 5);
  });

  it("adds star power while whammying a star sustain", () => {
    const s = session([note(0, 5, [0], { duration: 3, star: true })]);
    hit(s, 5);
    s.setWhammy(true);
    s.update(7.5);
    expect(s.snapshot().starPower).toBeGreaterThan(0.25);
  });
});

describe("HOPO", () => {
  it("hits a flagged HOPO by fretting alone only after the prior note was hit", () => {
    const s = session([note(0, 5, [0]), note(1, 5.3, [1], { hopo: true })]);
    hit(s, 5);
    s.releaseFret(0, 5.05);
    const events = s.pressFret(1, 5.3);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "judgement",
        noteId: 1,
        judgement: "perfect",
        hopoHit: true,
      }),
    );
    expect(s.snapshot().streak).toBe(2);
  });

  it("does not grant a fretted hit when the prior note was missed", () => {
    const s = session([note(0, 5, [0]), note(1, 5.3, [1], { hopo: true })]);
    s.update(5.2);
    s.pressFret(1, 5.3);
    expect(s.snapshot().noteStates[1]?.status).toBe("pending");
    s.update(5.5);
    expect(s.snapshot().noteStates[1]?.status).toBe("missed");
  });

  it("forgives a strum immediately after a fretted HOPO", () => {
    const s = session([note(0, 5, [0]), note(1, 5.3, [1], { hopo: true })]);
    hit(s, 5);
    s.releaseFret(0, 5.05);
    s.pressFret(1, 5.3);
    const strumEvents = s.strum(5.31);
    expect(strumEvents).not.toContainEqual(expect.objectContaining({ type: "overstrum" }));
    expect(s.snapshot().streak).toBe(2);
    expect(s.snapshot().rock).toBeGreaterThan(0.6);
  });

  it("requires a strum for HOPO notes when HOPO relief is disabled", () => {
    const s = session([note(0, 5, [0]), note(1, 5.3, [1], { hopo: true })], {
      hopoEnabled: false,
    });
    hit(s, 5);
    s.releaseFret(0, 5.05);
    s.pressFret(1, 5.3);
    expect(s.snapshot().noteStates[1]?.status).toBe("pending");
    const events = s.strum(5.31);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "judgement", noteId: 1, judgement: "perfect" }),
    );
  });

  it("can strum every note on a HOPO-heavy chart without overstrums", () => {
    const notes = Array.from({ length: 24 }, (_, index) =>
      note(index, 2 + index * 0.5, [(index % 5) as Lane], { hopo: index % 2 === 1 }),
    );
    const s = session(notes);
    const events = [];
    for (const entry of notes) {
      for (const lane of entry.lanes) events.push(...s.pressFret(lane, entry.time));
      events.push(...s.strum(entry.time));
      for (const lane of entry.lanes) s.releaseFret(lane, entry.time + 0.02);
    }
    expect(events.some((event) => event.type === "overstrum")).toBe(false);
    expect(s.snapshot().judgeCounts.miss).toBe(0);
    expect(s.snapshot().streak).toBe(24);
  });

  it("times out an unfretted HOPO as a miss", () => {
    const s = session([note(0, 5, [0]), note(1, 5.3, [1], { hopo: true })]);
    hit(s, 5);
    s.releaseFret(0, 5.05);
    s.update(5.5);
    expect(s.snapshot().noteStates[1]?.status).toBe("missed");
    expect(s.snapshot().judgeCounts.miss).toBe(1);
  });
});

describe("rock meter and finish", () => {
  it("fails the run when the rock meter empties", () => {
    const notes = Array.from({ length: 14 }, (_, i) => note(i, i + 1, [0]));
    const s = session(notes);
    s.update(30);
    const snap = s.snapshot();
    expect(snap.failed).toBe(true);
    expect(snap.rock).toBe(0);
    expect(snap.finished).toBe(false);
    expect(snap.score).toBe(0);
  });

  it("keeps a no-fail run alive with an empty rock meter", () => {
    const notes = Array.from({ length: 14 }, (_, i) => note(i, i + 1, [0]));
    const s = session(notes, { noFail: true });
    s.update(30);
    expect(s.snapshot().failed).toBe(false);
    expect(s.snapshot().rock).toBe(0);
  });

  it("finishes at the chart end after every note is decided", () => {
    const s = session([note(0, 1, [0])], {}, { duration: 10 });
    s.update(9.9);
    expect(s.snapshot().finished).toBe(false);
    const events = s.update(10);
    expect(events).toContainEqual(expect.objectContaining({ type: "finished" }));
    expect(s.snapshot().finished).toBe(true);
  });

  it("skips notes before the practice start and excludes them from accuracy", () => {
    const s = session([note(0, 1, [0]), note(1, 5, [0]), note(2, 9, [0])], { startTime: 4 });
    expect(s.snapshot().totalNotes).toBe(2);
    expect(s.snapshot().noteStates[0]?.status).toBe("skipped");
    hit(s, 5);
    expect(s.snapshot().accuracy).toBe(1);
  });
});
