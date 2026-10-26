import { describe, expect, it } from "vitest";
import { decideFaceOffWinner } from "./faceoff";
import { GameSession } from "./session";
import type { Chart } from "./types";

describe("face-off winner", () => {
  it("awards the survivor when only one player fails", () => {
    expect(decideFaceOffWinner({ failed: true, score: 9000 }, { failed: false, score: 100 })).toBe(
      2,
    );
    expect(decideFaceOffWinner({ failed: false, score: 100 }, { failed: true, score: 9000 })).toBe(
      1,
    );
  });

  it("uses the higher score when both survive", () => {
    expect(decideFaceOffWinner({ failed: false, score: 500 }, { failed: false, score: 700 })).toBe(
      2,
    );
    expect(decideFaceOffWinner({ failed: false, score: 700 }, { failed: false, score: 500 })).toBe(
      1,
    );
    expect(decideFaceOffWinner({ failed: false, score: 500 }, { failed: false, score: 500 })).toBe(
      "draw",
    );
  });

  it("keeps two sessions on the same chart independent", () => {
    const chart: Chart = {
      songId: "faceoff-test",
      difficulty: "medium",
      notes: Array.from({ length: 8 }, (_, index) => ({
        id: index,
        time: 1 + index,
        lanes: [0] as const,
        duration: 0,
        star: false,
        hopo: false,
      })),
      sections: [{ id: "s", name: "Verse", start: 0, end: 20 }],
      duration: 20,
      parScore: 1000,
      bpm: 120,
    };
    const p1 = new GameSession(chart, { difficulty: "medium" });
    const p2 = new GameSession(chart, { difficulty: "medium" });
    for (let index = 0; index < 8; index += 1) {
      p1.pressFret(0, 1 + index);
      p1.strum(1 + index);
      p1.releaseFret(0, 1.02 + index);
    }
    for (let index = 0; index < 4; index += 1) {
      p2.pressFret(0, 1 + index);
      p2.strum(1 + index);
      p2.releaseFret(0, 1.02 + index);
    }
    p2.update(15);
    const one = p1.snapshot();
    const two = p2.snapshot();
    expect(one.streak).toBe(8);
    expect(two.streak).toBe(0);
    expect(one.score).toBeGreaterThan(two.score);
    expect(two.judgeCounts.miss).toBeGreaterThan(0);
    expect(decideFaceOffWinner(one, two)).toBe(1);
    expect(decideFaceOffWinner(two, one)).toBe(2);
  });

  it("makes the first to fail lose when both fail", () => {
    expect(
      decideFaceOffWinner({ failed: true, score: 5000 }, { failed: true, score: 100 }, [10, 12]),
    ).toBe(2);
    expect(
      decideFaceOffWinner({ failed: true, score: 100 }, { failed: true, score: 5000 }, [12, 10]),
    ).toBe(1);
  });
});
