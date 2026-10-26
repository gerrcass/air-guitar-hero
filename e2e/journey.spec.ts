import { expect, test } from "@playwright/test";
import {
  expectNoConsoleErrors,
  gotoRoute,
  pauseAndEnd,
  startRunFromGate,
  trackConsole,
} from "../e2e/helpers";

test.describe("quickplay journey", () => {
  test("select a non-default song and difficulty, play, pause, resume, and reach results", async ({
    page,
  }) => {
    const console = trackConsole(page);
    await gotoRoute(page, "#/quickplay");

    await page
      .getByRole("button", { name: /Gutter Halo/ })
      .first()
      .click();
    await page
      .getByRole("group", { name: "Difficulty" })
      .getByRole("button", { name: /Hard/ })
      .click();
    await page.getByRole("link", { name: /Play “Gutter Halo”/ }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/gutter halo/i);
    await expect(page.locator(".gate-panel .eyebrow")).toContainText(/hard/i);
    await startRunFromGate(page);

    await page.keyboard.press("Escape");
    const dialog = page.getByRole("dialog", { name: "Run paused" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "End run & see results" }).click();
    await expect(page).toHaveURL(/#\/results/);
    await expect(page.locator(".results-score__value")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to Quickplay/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Practice this song/ })).toBeVisible();
    expectNoConsoleErrors(console);
  });

  test("a real paused run keeps the HUD and canvas intact after resume", async ({ page }) => {
    await gotoRoute(page, "#/play/quickplay/neon-throttle/easy");
    await startRunFromGate(page);
    await page.waitForTimeout(1200);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Run paused" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Run paused" })
      .getByRole("button", { name: "Resume" })
      .click();
    await expect(page.getByRole("dialog", { name: "Run paused" })).toBeHidden();
    await expect(page.locator(".highway-canvas")).toBeVisible();
    await pauseAndEnd(page);
  });
});
