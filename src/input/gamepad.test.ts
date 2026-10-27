// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assignPads, attachGamepads } from "./gamepad";

interface FakePad {
  readonly index: number;
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  readonly axes: readonly number[];
}

function pad(index: number, pressed: number[] = []): FakePad {
  return {
    index,
    buttons: Array.from({ length: 17 }, (_, button) => ({
      pressed: pressed.includes(button),
      value: pressed.includes(button) ? 1 : 0,
    })),
    axes: [0, 0, 0, 0],
  };
}

let pads: (FakePad | null)[] = [];
let scheduled: { readonly id: number; readonly callback: FrameRequestCallback } | null = null;
let nextFrameId = 0;

function tick(): void {
  const current = scheduled;
  scheduled = null;
  current?.callback(0);
}

function disconnect(index: number): void {
  const event = new Event("gamepaddisconnected");
  Object.defineProperty(event, "gamepad", { value: { index } });
  window.dispatchEvent(event);
}

function connect(index: number): void {
  const event = new Event("gamepadconnected");
  Object.defineProperty(event, "gamepad", { value: { index } });
  window.dispatchEvent(event);
}

function makeCallbacks() {
  return {
    onFretDown: vi.fn(),
    onFretUp: vi.fn(),
    onStrum: vi.fn(),
    onStarPower: vi.fn(),
    onPause: vi.fn(),
    onWhammy: vi.fn(),
  };
}

beforeEach(() => {
  pads = [];
  scheduled = null;
  nextFrameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
    nextFrameId += 1;
    scheduled = { id: nextFrameId, callback };
    return nextFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
    if (scheduled?.id === id) scheduled = null;
  });
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "getGamepads");
});

describe("pad assignment", () => {
  it("gives the first connected pad P1 and ignores extras in solo", () => {
    const assigned = assignPads([2, 5], new Map(), 1);
    expect([...assigned]).toEqual([[2, 1]]);
  });

  it("fills P1 then P2 in face-off and leaves a third pad unassigned", () => {
    const assigned = assignPads([4, 1, 7], new Map(), 2);
    expect([...assigned]).toEqual([
      [1, 1],
      [4, 2],
    ]);
  });

  it("keeps a surviving pad on its player and gives a hot-plugged pad the free slot", () => {
    const before = new Map<number, 1 | 2>([[1, 2]]);
    const assigned = assignPads([1, 3], before, 2);
    expect([...assigned]).toEqual([
      [1, 2],
      [3, 1],
    ]);
  });

  it("drops pads that are no longer connected", () => {
    const before = new Map<number, 1 | 2>([
      [0, 1],
      [1, 2],
    ]);
    expect([...assignPads([1], before, 2)]).toEqual([[1, 2]]);
  });
});

describe("gamepad attachment (mocked Gamepad API; browsers own the real hot-plug events)", () => {
  it("drives P1 and P2 from the first two connected pads and ignores a third", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 2);
    pads = [pad(0), pad(1), pad(2)];
    tick();

    pads[0] = pad(0, [0]);
    pads[1] = pad(1, [1]);
    pads[2] = pad(2, [2]);
    tick();

    expect(callbacks.onFretDown.mock.calls).toEqual([
      [1, 0],
      [2, 1],
    ]);
    handle.detach();
  });

  it("gives a replacement pad P1 when it appears as the old P1 disappears", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 2);
    pads = [pad(0), pad(1)];
    tick();

    pads = [null, pad(1), pad(2, [2])];
    tick();

    expect(callbacks.onFretDown.mock.calls).toEqual([[1, 2]]);
    handle.detach();
  });

  it("assigns P2 when a second pad hot-plugs into face-off", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 2);
    pads = [pad(0)];
    tick();

    pads.push(pad(1, [1]));
    connect(1);
    tick();

    expect(callbacks.onFretDown).toHaveBeenCalledWith(2, 1);
    handle.detach();
  });

  it("hands solo play to the next pad when the first one disconnects", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 1);
    pads = [pad(0), pad(1)];
    tick();

    pads = [null, pad(1, [1])];
    tick();

    expect(callbacks.onFretDown.mock.calls).toEqual([[1, 1]]);
    handle.detach();
  });

  it("releases held frets and whammy when a pad disconnects", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 1);
    pads = [pad(0)];
    tick();
    pads[0] = pad(0, [0, 10]);
    tick();
    expect(callbacks.onWhammy).toHaveBeenCalledWith(1, true);

    pads[0] = null;
    disconnect(0);

    expect(callbacks.onFretUp.mock.calls).toEqual([[1, 0]]);
    expect(callbacks.onWhammy).toHaveBeenLastCalledWith(1, false);
    handle.detach();
  });

  it("releases held frets when a pad vanishes between polls", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 1);
    pads = [pad(0)];
    tick();
    pads[0] = pad(0, [3]);
    tick();

    pads[0] = null;
    tick();

    expect(callbacks.onFretUp.mock.calls).toEqual([[1, 3]]);
    handle.detach();
  });

  it("does not repeat a held fret when another pad connects", () => {
    const callbacks = makeCallbacks();
    const handle = attachGamepads(callbacks, 2);
    pads = [pad(0, [0])];
    tick();
    expect(callbacks.onFretDown).toHaveBeenCalledTimes(1);

    pads.push(pad(1));
    connect(1);
    tick();

    expect(callbacks.onFretDown).toHaveBeenCalledTimes(1);
    handle.detach();
  });
});
