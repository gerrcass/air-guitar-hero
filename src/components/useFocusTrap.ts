import { type RefObject, useEffect } from "react";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep keyboard focus inside an open modal and restore it on close. Screens own Escape
 * handling; this hook only runs for dialogs that need trapping.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = ref.current;
    if (!element) return;
    const items = (): HTMLElement[] =>
      Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (candidate) => candidate.getClientRects().length > 0,
      );
    const first = items()[0];
    const timer = window.setTimeout(() => first?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;
      const focusable = items();
      if (focusable.length === 0) return;
      const current = document.activeElement;
      const index = current instanceof HTMLElement ? focusable.indexOf(current) : -1;
      if (event.shiftKey) {
        if (index <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
        }
      } else if (index === -1 || index === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [active, ref]);
}
