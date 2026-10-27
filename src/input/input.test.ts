import { describe, expect, it } from "vitest";
import { decodeStandardPad, PadEdgeTracker } from "./gamepad";
import { keyboardAction, P1_BINDINGS, P2_BINDINGS } from "./keyboard";

function buttons(pressedIndices: number[]) {
  return Array.from({ length: 17 }, (_, index) => ({
    pressed: pressedIndices.includes(index),
    value: pressedIndices.includes(index) ? 1 : 0,
  }));
}

describe("keyboard map", () => {
  it("maps the default solo controls", () => {
    expect(keyboardAction("KeyA", 1, "down")).toEqual({ kind: "fret", player: 1, lane: 0 });
    expect(keyboardAction("Space", 1, "down")).toEqual({ kind: "strum", player: 1 });
    expect(keyboardAction("KeyQ", 1, "down")).toEqual({ kind: "starPower", player: 1 });
    expect(keyboardAction("KeyW", 1, "down")).toEqual({ kind: "whammy", player: 1 });
    expect(keyboardAction("Enter", 1, "down")).toEqual({ kind: "starPower", player: 1 });
    expect(keyboardAction("Escape", 1, "down")).toEqual({ kind: "pause" });
  });

  it("ignores player 2 in solo and maps both players in face-off", () => {
    expect(keyboardAction("KeyH", 1, "down")).toBeNull();
    expect(keyboardAction("KeyH", 2, "down")).toEqual({ kind: "fret", player: 2, lane: 0 });
    expect(keyboardAction("Semicolon", 2, "down")).toEqual({
      kind: "fret",
      player: 2,
      lane: 4,
    });
    expect(keyboardAction("ShiftRight", 2, "down")).toEqual({ kind: "strum", player: 2 });
    expect(keyboardAction("Enter", 2, "down")).toEqual({ kind: "strum", player: 2 });
    expect(keyboardAction("KeyP", 2, "down")).toEqual({ kind: "starPower", player: 2 });
    expect(keyboardAction("KeyO", 2, "down")).toEqual({ kind: "whammy", player: 2 });
  });

  it("emits releases only for frets and whammy", () => {
    expect(keyboardAction("KeyG", 1, "up")).toEqual({ kind: "fret", player: 1, lane: 4 });
    expect(keyboardAction("Space", 1, "up")).toBeNull();
    expect(keyboardAction("KeyW", 1, "up")).toEqual({ kind: "whammy", player: 1 });
  });

  it("keeps the documented bindings stable", () => {
    expect(P1_BINDINGS.frets).toEqual(["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"]);
    expect(P2_BINDINGS.frets).toEqual(["KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"]);
    expect(P1_BINDINGS.strums).toEqual(["Space"]);
    expect(P2_BINDINGS.strums).toContain("Enter");
  });
});

describe("gamepad decoding", () => {
  it("maps standard face buttons and bumpers into five frets", () => {
    const frame = decodeStandardPad(buttons([0, 2, 5, 7, 9, 10]));
    expect(frame.frets).toEqual([true, false, true, false, true]);
    expect(frame.strum).toBe(true);
    expect(frame.star).toBe(true);
    expect(frame.whammy).toBe(true);
  });

  it("produces one-shot edges for strums, stars and frets", () => {
    const tracker = new PadEdgeTracker();
    const first = tracker.update(decodeStandardPad(buttons([0, 4, 9])));
    expect(first.fretDown).toEqual([0]);
    expect(first.strum).toBe(true);
    expect(first.star).toBe(true);

    const held = tracker.update(decodeStandardPad(buttons([0, 4, 9])));
    expect(held.fretDown).toEqual([]);
    expect(held.strum).toBe(false);
    expect(held.star).toBe(false);

    const released = tracker.update(decodeStandardPad(buttons([])));
    expect(released.fretUp).toEqual([0]);
    expect(released.strum).toBe(false);
  });

  it("reports whammy changes once", () => {
    const tracker = new PadEdgeTracker();
    const on = tracker.update(decodeStandardPad(buttons([10])));
    expect(on.whammyChanged).toBe(true);
    expect(on.whammy).toBe(true);
    const still = tracker.update(decodeStandardPad(buttons([10])));
    expect(still.whammyChanged).toBe(false);
    const off = tracker.update(decodeStandardPad(buttons([])));
    expect(off.whammyChanged).toBe(true);
    expect(off.whammy).toBe(false);
  });
});
