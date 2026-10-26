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

  /** Release everything still held, for a pad that is leaving the session. */
  release(): PadEdges {
    const previous = this.previous;
    this.previous = null;
    if (!previous) {
      return {
        fretDown: [],
        fretUp: [],
        strum: false,
        star: false,
        whammyChanged: false,
        whammy: false,
      };
    }
    const fretUp: Lane[] = [];
    for (let lane = 0; lane < 5; lane += 1) {
      if (previous.frets[lane]) fretUp.push(lane as Lane);
    }
    return {
      fretDown: [],
      fretUp,
      strum: false,
      star: false,
      whammyChanged: previous.whammy,
      whammy: false,
    };
  }
}

/**
 * Resolve which connected pads drive which players. A pad keeps its player for as long as
 * it stays connected; new pads fill free slots in connection order. Pads beyond the player
 * count are ignored instead of doubling up on a player.
 */
export function assignPads(
  connected: readonly number[],
  previous: ReadonlyMap<number, InputPlayer>,
  players: 1 | 2,
): Map<number, InputPlayer> {
  const present = new Set(connected);
  const next = new Map<number, InputPlayer>();
  for (const [index, player] of previous) {
    if (present.has(index) && (players === 2 || player === 1)) next.set(index, player);
  }
  const used = new Set(next.values());
  const slots: readonly InputPlayer[] = players === 2 ? [1, 2] : [1];
  for (const index of [...present].sort((left, right) => left - right)) {
    if (next.has(index)) continue;
    const open = slots.find((player) => !used.has(player));
    if (open === undefined) continue;
    next.set(index, open);
    used.add(open);
  }
  return next;
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
  let active = new Map<number, InputPlayer>();

  const releasePad = (index: number): void => {
    const player = active.get(index);
    const tracker = trackers.get(index);
    if (player && tracker) {
      const edges = tracker.release();
      for (const lane of edges.fretUp) callbacks.onFretUp(player, lane);
      if (edges.whammyChanged) callbacks.onWhammy(player, false);
    }
    active.delete(index);
    trackers.delete(index);
  };

  const poll = (): void => {
    raf = requestAnimationFrame(poll);
    if (typeof navigator.getGamepads !== "function") return;
    const pads = navigator.getGamepads();
    const connected: number[] = [];
    for (let index = 0; index < pads.length; index += 1) {
      if (pads[index]) connected.push(index);
    }
    const next = assignPads(connected, active, players);
    for (const index of active.keys()) {
      if (!next.has(index)) releasePad(index);
    }
    active = next;
    for (const [index, assigned] of active) {
      const pad = pads[index];
      if (!pad) continue;
      const tracker = trackers.get(index) ?? new PadEdgeTracker();
      trackers.set(index, tracker);
      const edges = tracker.update(decodeStandardPad(pad.buttons));
      for (const lane of edges.fretDown) callbacks.onFretDown(assigned, lane);
      for (const lane of edges.fretUp) callbacks.onFretUp(assigned, lane);
      if (edges.strum) callbacks.onStrum(assigned);
      if (edges.star) callbacks.onStarPower(assigned);
      if (edges.whammyChanged) callbacks.onWhammy(assigned, edges.whammy);
    }
  };
  raf = requestAnimationFrame(poll);

  const onConnected = (event: GamepadEvent): void => {
    // Only the new pad starts from a clean frame. Resetting every tracker would repeat
    // held frets on pads that never left, which reads as a second press.
    trackers.delete(event.gamepad.index);
  };
  const onDisconnected = (event: GamepadEvent): void => {
    releasePad(event.gamepad.index);
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
