import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, gotoRoute, trackConsole } from "../e2e/helpers";

test.describe("face-off", () => {
  test("starts two independent highways, reaches a winner, and rematches cleanly", async ({
    page,
  }) => {
    const console = trackConsole(page);
    await gotoRoute(page, "#/faceoff");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/two players/i);
    await page.getByRole("button", { name: /Start face-off/ }).click();
    await expect(page.locator(".faceoff-side")).toHaveCount(2);
    await expect(page.locator(".faceoff-hud--p1")).toBeVisible();
    await expect(page.locator(".faceoff-hud--p2")).toBeVisible();
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape");
    const pauseDialog = page.getByRole("dialog", { name: "Face-off paused" });
    await expect(pauseDialog).toBeVisible();
    await expect(pauseDialog.getByRole("button", { name: "Resume" })).toBeFocused();
    for (let index = 0; index < 7; index += 1) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]"))),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(pauseDialog).toBeHidden();
    await page.evaluate(() => window.__AGH_TEST__?.autoplay?.(8));
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.__AGH_TEST__?.finishRun?.());
    await expect(page.locator(".faceoff-result")).toBeVisible();
    await expect(
      page.locator(".faceoff-result").getByRole("button", { name: "Rematch" }),
    ).toBeFocused();
    for (let index = 0; index < 7; index += 1) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest(".faceoff-result"))),
    ).toBe(true);
    await expect(page.locator(".faceoff-result h2")).toContainText(/player/i);
    await expect(page.locator(".faceoff-result__scores")).toContainText("Player 1");
    await expect(page.locator(".faceoff-result__scores")).toContainText("Player 2");
    await expect(page.locator(".faceoff-result__scores")).toContainText("accuracy");

    await page.getByRole("button", { name: "Rematch" }).click();
    await expect(page.locator(".faceoff-side")).toHaveCount(2);
    await expect(page.locator(".faceoff-hud__score").first()).toContainText("0");
    await page.getByRole("button", { name: "Quit" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/two players/i);
    expectNoConsoleErrors(console);
  });
});
