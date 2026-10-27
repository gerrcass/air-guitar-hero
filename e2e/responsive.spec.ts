import { expect, test } from "@playwright/test";
import { gotoRoute, startRunFromGate } from "../e2e/helpers";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
  { width: 820, height: 1180 },
];

test.describe("responsive layout", () => {
  test("menu and quickplay never overflow the viewport", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const hash of ["#/", "#/quickplay", "#/career", "#/settings"]) {
        await gotoRoute(page, hash);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${hash} at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("face-off split stays readable at 1280x720 with two labelled HUDs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoRoute(page, "#/faceoff");
    await page.getByRole("button", { name: /Start face-off/ }).click();
    await expect(page.locator(".faceoff-side")).toHaveCount(2);
    await expect(page.locator(".faceoff-hud--p1")).toBeVisible();
    await expect(page.locator(".faceoff-hud--p2")).toBeVisible();
    const [p1, p2] = await Promise.all([
      page.locator(".faceoff-hud--p1").boundingBox(),
      page.locator(".faceoff-hud--p2").boundingBox(),
    ]);
    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    if (p1 && p2) {
      expect(p1.x + p1.width).toBeLessThanOrEqual(p2.x + 1);
      expect(p1.height).toBeGreaterThan(60);
    }
    await page.getByRole("button", { name: "Quit" }).click();
  });

  test("results and gameplay keep their layout at every supported size", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoRoute(page, "#/play/quickplay/neon-throttle/easy");
    await startRunFromGate(page);
    const hud = await page.locator(".run-hud").boundingBox();
    expect(hud).not.toBeNull();
    if (hud) {
      expect(hud.x).toBeGreaterThanOrEqual(0);
      expect(hud.y).toBeGreaterThanOrEqual(0);
      expect(hud.width).toBeLessThanOrEqual(1280);
    }
    await page.evaluate(() => window.__AGH_TEST__?.completeRun?.());
    await page.waitForURL(/#\/results/);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `results at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
    }
  });

  test("mobile menus explain the keyboard/gamepad requirement", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoRoute(page, "#/");
    await expect(page.locator(".mobile-note")).toBeVisible();
    await expect(page.locator(".mobile-note")).toContainText("keyboard or gamepad");
    await gotoRoute(page, "#/play/quickplay/neon-throttle/easy");
    await expect(page.locator(".mobile-gate-note")).toBeVisible();
    await expect(page.locator(".mobile-gate-note")).toContainText("keyboard or gamepad");
    await gotoRoute(page, "#/extras");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
