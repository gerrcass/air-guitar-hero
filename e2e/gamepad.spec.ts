import { expect, test } from "@playwright/test";
import { installFakePad, pressPadButton } from "./fake-pad";
import { gotoRoute } from "./helpers";

test.describe("gamepad-only paths", () => {
  test("a pad starts a solo run, pauses it, and resumes from the pause dialog", async ({
    page,
  }) => {
    await installFakePad(page);
    await gotoRoute(page, "#/play/quickplay/neon-throttle/easy");
    await page.waitForTimeout(500);
    await pressPadButton(page, 0); // A on the focused Start button
    await expect(page.locator(".gameplay-screen")).toBeVisible();
    await expect(page.locator(".highway-canvas")).toBeVisible();

    await page.waitForTimeout(500);
    await pressPadButton(page, 8); // Back pauses the live run
    const dialog = page.getByRole("dialog", { name: "Run paused" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Resume" })).toBeFocused();

    await pressPadButton(page, 0); // A activates the focused Resume button
    await expect(dialog).toBeHidden();
  });

  test("the menu hook is suspended during tutorial play", async ({ page }) => {
    await installFakePad(page);
    await gotoRoute(page, "#/tutorial");
    await page.getByRole("button", { name: "Start lesson" }).first().click();
    await expect(page.locator(".tutorial-play")).toBeVisible();
    await page.waitForTimeout(400);
    await pressPadButton(page, 13); // D-pad down should not move page focus
    await pressPadButton(page, 0); // A should not activate menu chrome
    await expect(page.locator(".tutorial-play")).toBeVisible();
    await expect(page.locator(".tutorial-top h1")).toContainText("Single notes");
    await expect(page).not.toHaveURL(/#\/$/);
  });

  test("face-off play suspends menu navigation and a pad can pause it", async ({ page }) => {
    await installFakePad(page);
    await gotoRoute(page, "#/faceoff");
    await page.waitForTimeout(500);
    await pressPadButton(page, 0); // A on the focused Start face-off button
    await expect(page.locator(".faceoff-split")).toBeVisible();
    await page.waitForTimeout(400);
    await pressPadButton(page, 13); // D-pad down must not eject the match
    await pressPadButton(page, 0);
    await expect(page.locator(".faceoff-split")).toBeVisible();
    await pressPadButton(page, 8);
    const dialog = page.getByRole("dialog", { name: "Face-off paused" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Resume" })).toBeFocused();
    await pressPadButton(page, 0);
    await expect(dialog).toBeHidden();
  });

  test("A cycles a native select when the pad is navigating a menu", async ({ page }) => {
    await installFakePad(page);
    await gotoRoute(page, "#/practice");
    const sectionSelect = page.locator("select").nth(1);
    await sectionSelect.focus();
    const before = await sectionSelect.evaluate(
      (element) => (element as HTMLSelectElement).selectedIndex,
    );
    await pressPadButton(page, 0);
    const after = await sectionSelect.evaluate(
      (element) => (element as HTMLSelectElement).selectedIndex,
    );
    expect(after).not.toBe(before);
  });
});
