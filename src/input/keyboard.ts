import type { Lane } from "../game/types";

export type InputPlayer = 1 | 2;

export type KeyboardAction =
  | { readonly kind: "fret"; readonly player: InputPlayer; readonly lane: Lane }
  | { readonly kind: "strum"; readonly player: InputPlayer }
  | { readonly kind: "starPower"; readonly player: InputPlayer }
  | { readonly kind: "whammy"; readonly player: InputPlayer }
  | { readonly kind: "pause" };

export interface PlayerBindings {
  readonly frets: readonly string[];
  readonly strums: readonly string[];
  readonly starPower: readonly string[];
  readonly whammy: readonly string[];
}

export const P1_BINDINGS: PlayerBindings = {
  frets: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"],
  strums: ["Space"],
  starPower: ["KeyQ", "Enter"],
  whammy: ["KeyW"],
};

export const P2_BINDINGS: PlayerBindings = {
  frets: ["KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  strums: ["ShiftRight", "Enter"],
  starPower: ["KeyP"],
  whammy: ["KeyO"],
};

export const KEY_HINTS: Readonly<Record<InputPlayer, readonly string[]>> = {
  1: ["A", "S", "D", "F", "G"],
  2: ["H", "J", "K", "L", ";"],
};

export function keyboardAction(
  code: string,
  players: 1 | 2,
  phase: "down" | "up",
): KeyboardAction | null {
  if (code === "Escape") return phase === "down" ? { kind: "pause" } : null;
  if (phase === "down") {
    for (const [player, bindings] of [
      [1, P1_BINDINGS],
      [2, P2_BINDINGS],
    ] as const) {
      if (player === 2 && players === 1) continue;
      if (player === 1 && players === 2 && code === "Enter") continue;
      const fretIndex = bindings.frets.indexOf(code);
      if (fretIndex >= 0) {
        return { kind: "fret", player, lane: fretIndex as Lane };
      }
      if (bindings.strums.includes(code)) {
        // Enter is an alternative P2 strum in face-off and P1 star power in solo.
        if (code === "Enter" && player === 1) {
          return { kind: "starPower", player: 1 };
        }
        return { kind: "strum", player };
      }
      if (bindings.starPower.includes(code)) {
        return { kind: "starPower", player };
      }
      if (bindings.whammy.includes(code)) {
        return { kind: "whammy", player };
      }
    }
    return null;
  }
  for (const [player, bindings] of [
    [1, P1_BINDINGS],
    [2, P2_BINDINGS],
  ] as const) {
    if (player === 2 && players === 1) continue;
    const fretIndex = bindings.frets.indexOf(code);
    if (fretIndex >= 0) return { kind: "fret", player, lane: fretIndex as Lane };
    if (bindings.whammy.includes(code)) return { kind: "whammy", player };
  }
  return null;
}

export interface KeyboardCallbacks {
  readonly onFretDown: (player: InputPlayer, lane: Lane) => void;
  readonly onFretUp: (player: InputPlayer, lane: Lane) => void;
  readonly onStrum: (player: InputPlayer) => void;
  readonly onStarPower: (player: InputPlayer) => void;
  readonly onWhammy: (player: InputPlayer, down: boolean) => void;
  readonly onPause: () => void;
}

/** Attach the keyboard map to a live run. Always detach on unmount. */
export function attachKeyboard(callbacks: KeyboardCallbacks, players: 1 | 2): () => void {
  const pressed = new Set<string>();
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    const action = keyboardAction(event.code, players, "down");
    if (!action) return;
    event.preventDefault();
    pressed.add(event.code);
    if (action.kind === "fret") callbacks.onFretDown(action.player, action.lane);
    else if (action.kind === "strum") callbacks.onStrum(action.player);
    else if (action.kind === "starPower") callbacks.onStarPower(action.player);
    else if (action.kind === "whammy") callbacks.onWhammy(action.player, true);
    else callbacks.onPause();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (!pressed.has(event.code)) return;
    pressed.delete(event.code);
    const action = keyboardAction(event.code, players, "up");
    if (!action) return;
    event.preventDefault();
    if (action.kind === "fret") callbacks.onFretUp(action.player, action.lane);
    else if (action.kind === "whammy") callbacks.onWhammy(action.player, false);
  };
  const onBlur = (): void => {
    for (const code of pressed) {
      const action = keyboardAction(code, players, "up");
      if (action?.kind === "fret") callbacks.onFretUp(action.player, action.lane);
      else if (action?.kind === "whammy") callbacks.onWhammy(action.player, false);
    }
    pressed.clear();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}
