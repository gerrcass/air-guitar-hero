import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, gotoRoute, startRunFromGate, trackConsole } from "../e2e/helpers";

test.describe("career progression", () => {
  test("clears the first song, unlocks the second, and persists across reload", async ({
    page,
  }) => {
    const console = trackConsole(page);
    await gotoRoute(page, "#/career");
    await expect(page.getByText(/three rooms\. four songs each/i)).toBeVisible();
    await expect(page.getByText(/Clear "Neon Throttle" to unlock this song\./)).toBeVisible();
    await expect(page.getByRole("button", { name: /Gutter Halo/ })).toHaveCount(0);

    await gotoRoute(page, "#/play/career/neon-throttle/medium");
    await startRunFromGate(page);
    await page.evaluate(() => window.__AGH_TEST__?.finishRun?.({ passed: true, scoreRatio: 1 }));
    await page.waitForURL(/#\/results/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/the crowd heard you/i);
    await expect(page.locator(".new-best")).toBeVisible();

    await gotoRoute(page, "#/career");
    await expect(page.getByRole("button", { name: /Gutter Halo/ })).toBeVisible();
    await expect(page.getByText(/Clear "Gutter Halo" to unlock this song\./)).toBeVisible();
    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();

    const saved = await page.evaluate(() => {
      const raw = window.localStorage.getItem("air-guitar-hero.save.v1");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved?.career?.medium?.cleared?.["neon-throttle"]).toBe(5);
    expect(saved?.best?.["neon-throttle:medium"]?.stars).toBe(5);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Gutter Halo/ })).toBeVisible();
    expectNoConsoleErrors(console);
  });

  test("tracks difficulties independently", async ({ page }) => {
    await gotoRoute(page, "#/play/career/neon-throttle/easy");
    await startRunFromGate(page);
    await page.evaluate(() => window.__AGH_TEST__?.finishRun?.({ passed: true, scoreRatio: 0.6 }));
    await page.waitForURL(/#\/results/);
    await gotoRoute(page, "#/career");
    await page
      .getByRole("group", { name: "Difficulty" })
      .getByRole("button", { name: /Easy/ })
      .click();
    await expect(page.getByRole("button", { name: /Gutter Halo/ })).toBeVisible();
    await page
      .getByRole("group", { name: "Difficulty" })
      .getByRole("button", { name: /Medium/ })
      .click();
    await expect(page.getByRole("button", { name: /Gutter Halo/ })).toHaveCount(0);
  });

  test("a failed career run does not unlock anything", async ({ page }) => {
    await gotoRoute(page, "#/play/career/neon-throttle/medium");
    await startRunFromGate(page);
    await page.evaluate(() => window.__AGH_TEST__?.failRun?.());
    await page.waitForURL(/#\/results/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/the room went quiet/i);
    await gotoRoute(page, "#/career");
    await expect(page.getByRole("button", { name: /Gutter Halo/ })).toHaveCount(0);
    await expect(page.getByText(/Clear "Neon Throttle" to unlock this song\./)).toBeVisible();
  });
});
