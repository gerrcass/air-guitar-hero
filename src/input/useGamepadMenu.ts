import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.offsetParent !== null &&
      !element.closest("[inert]") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

function moveFocus(direction: number): void {
  const items = focusables();
  if (items.length === 0) return;
  const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const index = current ? items.indexOf(current) : -1;
  const next =
    index < 0
      ? direction > 0
        ? 0
        : items.length - 1
      : (index + direction + items.length) % items.length;
  const target = items[next];
  target?.focus();
  target?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function adjustRange(direction: number): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || active.type !== "range") return false;
  const step = Number(active.step) || 1;
  const min = Number(active.min);
  const max = Number(active.max);
  const current = Number(active.value);
  const lower = Number.isFinite(min) ? min : current - step;
  const upper = Number.isFinite(max) ? max : current + step;
  const next = Math.min(upper, Math.max(lower, current + direction * step));
  active.value = String(next);
  active.dispatchEvent(new Event("input", { bubbles: true }));
  active.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/** Navigate menus with a standard-mapping gamepad. Disabled during gameplay. */
export function useGamepadMenu(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== "function") return;
    let raf = 0;
    let previous: boolean[] = [];
    let lastMove = 0;
    const poll = (): void => {
      raf = requestAnimationFrame(poll);
      const now = performance.now();
      if (now - lastMove < 110) return;
      const pad = Array.from(navigator.getGamepads()).find(
        (candidate): candidate is Gamepad => candidate !== null,
      );
      if (!pad) return;
      const pressed = pad.buttons.map((button) => button.pressed || button.value > 0.5);
      const edge = (index: number): boolean =>
        (pressed[index] ?? false) && !(previous[index] ?? false);
      const up = edge(12) || (pad.axes[1] ?? 0) < -0.6;
      const down = edge(13) || (pad.axes[1] ?? 0) > 0.6;
      const left = edge(14) || (pad.axes[0] ?? 0) < -0.6;
      const right = edge(15) || (pad.axes[0] ?? 0) > 0.6;
      const select = edge(0) || edge(9);
      if (up) {
        moveFocus(-1);
        lastMove = now;
      } else if (down) {
        moveFocus(1);
        lastMove = now;
      } else if (left) {
        if (!adjustRange(-1)) moveFocus(-1);
        lastMove = now;
      } else if (right) {
        if (!adjustRange(1)) moveFocus(1);
        lastMove = now;
      } else if (select) {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.click();
        lastMove = now;
      }
      previous = pressed;
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
}
