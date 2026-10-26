import type { Page } from "@playwright/test";

interface FakePadWindow extends Window {
  __aghPadSet?: (index: number, pressed: boolean) => void;
}

/** Inject a standard-mapping pad before navigation so polling sees a real Gamepad shape. */
export async function installFakePad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = {
      index: 0,
      id: "Playwright standard pad",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: 0,
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    (window as FakePadWindow).__aghPadSet = (index, pressed) => {
      const button = buttons[index];
      if (!button) return;
      button.pressed = pressed;
      button.value = pressed ? 1 : 0;
    };
  });
}

export async function pressPadButton(page: Page, index: number): Promise<void> {
  await page.evaluate((button) => (window as FakePadWindow).__aghPadSet?.(button, true), index);
  await page.waitForTimeout(220);
  await page.evaluate((button) => (window as FakePadWindow).__aghPadSet?.(button, false), index);
  await page.waitForTimeout(160);
}
