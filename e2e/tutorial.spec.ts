import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, gotoRoute, trackConsole } from "../e2e/helpers";

test.describe("tutorial", () => {
  test("completes a lesson, marks the tutorial complete, and persists it", async ({ page }) => {
    const console = trackConsole(page);
    await gotoRoute(page, "#/tutorial");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/five reps/i);
    await page.getByRole("button", { name: "Start lesson" }).first().click();
    await expect(page.locator(".tutorial-top h1")).toContainText("Single notes");
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__AGH_TEST__?.completeLesson?.());
    await expect(page.locator(".lesson-outcome")).toBeVisible();
    await expect(page.locator(".lesson-outcome h2")).toContainText("Single notes");
    for (let index = 0; index < 6; index += 1) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest(".lesson-outcome"))),
    ).toBe(true);
    await page.getByRole("button", { name: "Back to lessons" }).click();
    await expect(page.locator(".tutorial-progress__value")).toContainText("1/5");

    await page.evaluate(() => window.__AGH_TEST__?.completeTutorial?.());
    await expect(page.locator(".tutorial-banner")).toBeVisible();
    await expect(page.locator(".tutorial-progress__value")).toContainText("5/5");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".tutorial-banner")).toBeVisible();
    const saved = await page.evaluate(() => {
      const raw = window.localStorage.getItem("air-guitar-hero.save.v1");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved?.tutorialComplete).toBe(true);
    expectNoConsoleErrors(console);
  });

  test("skips to the next lesson without marking the skipped one complete", async ({ page }) => {
    await gotoRoute(page, "#/tutorial");
    const cards = page.locator(".lesson-card");
    await cards.nth(1).getByRole("button", { name: "Start lesson" }).click();
    await expect(page.locator(".tutorial-top h1")).toContainText("Chords");
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.locator(".tutorial-top h1")).toContainText("Sustains");
    await page.getByRole("button", { name: "← Lessons" }).click();
    await expect(page.locator(".tutorial-progress__value")).toContainText("0/5");
    await expect(cards.nth(1).locator(".lesson-card__status")).toContainText("Not played");
  });
});
