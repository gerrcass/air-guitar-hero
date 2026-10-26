import type { Lane } from "../game/types";
import type { InputPlayer } from "./keyboard";

export interface PadFrame {
  readonly frets: readonly [boolean, boolean, boolean, boolean, boolean];
  readonly strum: boolean;
  readonly star: boolean;
  readonly whammy: boolean;
}

export interface PadEdges {
  readonly fretDown: readonly Lane[];
  readonly fretUp: readonly Lane[];
  readonly strum: boolean;
  readonly star: boolean;
  readonly whammyChanged: boolean;
  readonly whammy: boolean;
}

const FRET_BUTTONS = [0, 1, 2, 3, 5] as const;
const STRUM_BUTTONS = [4, 6, 7] as const;
const STAR_BUTTON = 9;
const WHAMMY_BUTTON = 10;

/** Map a standard-mapping gamepad into the game's five-fret vocabulary. */
export function decodeStandardPad(
  buttons: readonly { readonly pressed: boolean; readonly value: number }[],
): PadFrame {
  const pressed = (index: number): boolean =>
    (buttons[index]?.pressed ?? false) || (buttons[index]?.value ?? 0) > 0.5;
  return {
    frets: [
      pressed(FRET_BUTTONS[0]),
      pressed(FRET_BUTTONS[1]),
      pressed(FRET_BUTTONS[2]),
      pressed(FRET_BUTTONS[3]),
      pressed(FRET_BUTTONS[4]),
    ],
    strum: STRUM_BUTTONS.some(pressed),
    star: pressed(STAR_BUTTON),
    whammy: pressed(WHAMMY_BUTTON),
  };
}

/** Turn a stream of pad frames into one-shot edges for the engine. */
export class PadEdgeTracker {
  private previous: PadFrame | null = null;

  update(frame: PadFrame): PadEdges {
    const previous = this.previous;
    const fretDown: Lane[] = [];
    const fretUp: Lane[] = [];
    for (let lane = 0; lane < 5; lane += 1) {
      const now = frame.frets[lane] ?? false;
      const before = previous?.frets[lane] ?? false;
      if (now && !before) fretDown.push(lane as Lane);
      if (!now && before) fretUp.push(lane as Lane);
    }
    const edges: PadEdges = {
      fretDown,
      fretUp,
      strum: frame.strum && !(previous?.strum ?? false),
      star: frame.star && !(previous?.star ?? false),
      whammyChanged: frame.whammy !== (previous?.whammy ?? false),
      whammy: frame.whammy,
    };
    this.previous = frame;
    return edges;
  }

  reset(): void {
    this.previous = null;
  }
}

export interface GamepadCallbacks {
  readonly onFretDown: (player: InputPlayer, lane: Lane) => void;
  readonly onFretUp: (player: InputPlayer, lane: Lane) => void;
  readonly onStrum: (player: InputPlayer) => void;
  readonly onStarPower: (player: InputPlayer) => void;
  readonly onWhammy: (player: InputPlayer, down: boolean) => void;
}

export interface GamepadHandle {
  readonly detach: () => void;
  readonly connectedCount: () => number;
}

/**
 * Poll standard-mapping pads. The first connected pad drives P1 and the second drives P2
 * in face-off; hot-plugging simply changes the next poll.
 */
export function attachGamepads(callbacks: GamepadCallbacks, players: 1 | 2): GamepadHandle {
  let raf = 0;
  const trackers = new Map<number, PadEdgeTracker>();
  const active = new Map<number, InputPlayer>();

  const poll = (): void => {
    raf = requestAnimationFrame(poll);
    if (typeof navigator.getGamepads !== "function") return;
    const pads = navigator.getGamepads();
    const used = new Set(active.values());
    for (let index = 0; index < pads.length; index += 1) {
      const pad = pads[index];
      if (!pad) continue;
      let assigned = active.get(index);
      if (!assigned) {
        if (players === 1 && used.has(1)) continue;
        assigned = used.has(1) ? 2 : 1;
        active.set(index, assigned);
        used.add(assigned);
      }
      const tracker = trackers.get(index) ?? new PadEdgeTracker();
      trackers.set(index, tracker);
      const edges = tracker.update(decodeStandardPad(pad.buttons));
      for (const lane of edges.fretDown) callbacks.onFretDown(assigned, lane);
      for (const lane of edges.fretUp) callbacks.onFretUp(assigned, lane);
      if (edges.strum) callbacks.onStrum(assigned);
      if (edges.star) callbacks.onStarPower(assigned);
      if (edges.whammyChanged) callbacks.onWhammy(assigned, edges.whammy);
    }
    for (const [index] of active) {
      if (!pads[index]) {
        active.delete(index);
        trackers.delete(index);
      }
    }
  };
  raf = requestAnimationFrame(poll);

  const onConnected = (): void => {
    trackers.clear();
  };
  const onDisconnected = (event: GamepadEvent): void => {
    trackers.delete(event.gamepad.index);
    active.delete(event.gamepad.index);
  };
  window.addEventListener("gamepadconnected", onConnected);
  window.addEventListener("gamepaddisconnected", onDisconnected);
  return {
    detach: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("gamepadconnected", onConnected);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
    },
    connectedCount: () => {
      if (typeof navigator.getGamepads !== "function") return 0;
      return Array.from(navigator.getGamepads()).filter((pad) => pad !== null).length;
    },
  };
}
