// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGamepadMenu } from "./useGamepadMenu";

interface FakePad {
  readonly index: number;
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  readonly axes: readonly number[];
}

let pads: (FakePad | null)[] = [];
let scheduled: { readonly id: number; readonly callback: FrameRequestCallback } | null = null;
let nextFrameId = 0;
let clock = 1000;

function pad(buttons: number[] = [], axes: [number, number] = [0, 0]): FakePad {
  return {
    index: 0,
    buttons: Array.from({ length: 17 }, (_, button) => ({
      pressed: buttons.includes(button),
      value: buttons.includes(button) ? 1 : 0,
    })),
    axes: [axes[0], axes[1], 0, 0],
  };
}

function tick(): void {
  const current = scheduled;
  scheduled = null;
  current?.callback(clock);
}

function frame(buttons: number[] = [], axes: [number, number] = [0, 0]): void {
  pads = [pad(buttons, axes)];
  act(() => tick());
}

function release(): void {
  frame([]);
  clock += 200;
}

function Menu({ enabled = true }: { readonly enabled?: boolean }): React.JSX.Element {
  useGamepadMenu(enabled);
  return (
    <div>
      <button type="button">First</button>
      <button type="button">Second</button>
      <button type="button">Third</button>
    </div>
  );
}

function RangeMenu({ onValue }: { readonly onValue: (value: number) => void }): React.JSX.Element {
  const [value, setValue] = useState(3);
  useGamepadMenu(true);
  return (
    <input
      aria-label="Note speed"
      type="range"
      min={1}
      max={5}
      step={1}
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value);
        setValue(next);
        onValue(next);
      }}
    />
  );
}

function ChoiceButton({ onChoose }: { readonly onChoose: () => void }): React.JSX.Element {
  useGamepadMenu(true);
  return (
    <button type="button" onClick={onChoose}>
      Choose
    </button>
  );
}

beforeEach(() => {
  pads = [];
  scheduled = null;
  nextFrameId = 0;
  clock = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
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
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "getGamepads");
});

describe("gamepad menu navigation", () => {
  it("moves focus with the D-pad in both directions", () => {
    render(<Menu />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    first.focus();

    frame([13]);
    expect(document.activeElement).toBe(second);

    release();
    frame([12]);
    expect(document.activeElement).toBe(first);
  });

  it("moves focus with the left stick", () => {
    render(<Menu />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    first.focus();

    frame([], [0, 1]);
    expect(document.activeElement).toBe(second);
  });

  it("activates the focused control with A", () => {
    const onClick = vi.fn();
    render(<ChoiceButton onChoose={onClick} />);
    const choose = screen.getByRole("button", { name: "Choose" });
    choose.focus();

    frame([0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("adjusts a focused range without moving focus", () => {
    const onValue = vi.fn();
    render(<RangeMenu onValue={onValue} />);
    const range = screen.getByRole("slider", { name: "Note speed" });
    range.focus();

    frame([15]);
    expect(document.activeElement).toBe(range);
    expect((range as HTMLInputElement).value).toBe("4");
    expect(onValue).toHaveBeenCalledWith(4);
  });

  it("does nothing while gameplay owns the input", () => {
    render(<Menu enabled={false} />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    first.focus();

    frame([13]);
    expect(document.activeElement).toBe(first);
    expect(document.activeElement).not.toBe(second);
  });
});
