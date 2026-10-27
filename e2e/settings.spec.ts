import { expect, test } from "@playwright/test";
import { gotoRoute } from "../e2e/helpers";

async function setRangeByIndex(
  page: import("@playwright/test").Page,
  index: number,
  value: number,
): Promise<void> {
  await page
    .locator('input[type="range"]')
    .nth(index)
    .evaluate((element, next) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(next));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}

test.describe("settings", () => {
  test("persists note speed and visual accessibility choices across reload", async ({ page }) => {
    await gotoRoute(page, "#/settings");
    await setRangeByIndex(page, 0, 5);
    await page.getByRole("checkbox", { name: /Colourblind palette/ }).check();
    await page.getByRole("checkbox", { name: /Reduce motion/ }).check();
    await page.getByRole("checkbox", { name: /Lane symbols/ }).check();
    await page.getByRole("checkbox", { name: /No fail/ }).check();
    await page.waitForTimeout(200);

    const saved = await page.evaluate(() => {
      const raw = window.localStorage.getItem("air-guitar-hero.save.v1");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved?.settings?.noteSpeed).toBe(5);
    expect(saved?.settings?.colorblindPalette).toBe(true);
    expect(saved?.settings?.reduceMotion).toBe(true);
    expect(saved?.settings?.noFail).toBe(true);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('input[type="range"]').first()).toHaveValue("5");
    await expect(page.getByRole("checkbox", { name: /Colourblind palette/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Reduce motion/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /No fail/ })).toBeChecked();

    await page.getByRole("button", { name: /Reset save/ }).click();
    await page.getByRole("button", { name: /Yes, reset everything/ }).click();
    await expect(page.locator('input[type="range"]').first()).toHaveValue("3");
    await expect(page.getByRole("checkbox", { name: /Colourblind palette/ })).not.toBeChecked();
  });

  test("shows a focusable recovery panel when audio resume fails mid-run", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      const Original = window.AudioContext;
      let resumes = 0;
      class FlakyAudioContext extends Original {
        override async resume(): Promise<void> {
          resumes += 1;
          if (resumes >= 2) throw new Error("resume blocked by test");
          return super.resume();
        }
      }
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: FlakyAudioContext,
      });
    });
    await page.goto("/air-guitar-hero/?e2e=1#/play/quickplay/neon-throttle/easy");
    await page.getByRole("button", { name: "Start run" }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Run paused" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Run paused" })
      .getByRole("button", { name: "Resume" })
      .click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/audio could not resume/i);
    await expect(alert.getByRole("button", { name: "Retry audio" })).toBeFocused();
    for (let index = 0; index < 5; index += 1) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest(".audio-error"))),
    ).toBe(true);
    await context.close();
  });

  test("shows a recoverable audio error when the AudioContext cannot start", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      class FailingAudioContext {
        constructor() {
          throw new Error("audio blocked by test");
        }
      }
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: FailingAudioContext,
      });
    });
    await page.goto("/air-guitar-hero/?e2e=1#/play/quickplay/neon-throttle/easy");
    await page.getByRole("button", { name: "Start run" }).click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Audio couldn't start/i);
    await expect(alert).toContainText(/audio blocked by test/i);
    await expect(page.getByRole("button", { name: "Start run" })).toBeVisible();
    await context.close();
  });
});
