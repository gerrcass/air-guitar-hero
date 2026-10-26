import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, gotoRoute, trackConsole } from "../e2e/helpers";

test.describe("shell and navigation", () => {
  test("loads the main menu and every top-level mode without console errors", async ({ page }) => {
    const console = trackConsole(page);
    await gotoRoute(page, "#/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/guitar/i);
    await expect(page.getByRole("navigation", { name: "Main modes" })).toBeVisible();

    for (const [name, heading] of [
      ["Career", /three rooms/i],
      ["Quickplay", /whole setlist/i],
      ["Practice", /drill the part/i],
      ["Face-off", /two players/i],
      ["Tutorial", /five reps/i],
      ["Settings", /make the rig/i],
      ["Extras", /everything the rig/i],
    ] as const) {
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    }
    expectNoConsoleErrors(console);
  });

  test("deep links survive a refresh under the Pages base path", async ({ page }) => {
    await gotoRoute(page, "#/play/quickplay/gutter-halo/hard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/gutter halo/i);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/gutter halo/i);
    await expect(page.getByRole("button", { name: "Start run" })).toBeVisible();

    await gotoRoute(page, "#/settings");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/make the rig/i);
  });

  test("keyboard focus reaches the primary play path with a visible focus ring", async ({
    page,
  }) => {
    await gotoRoute(page, "#/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus-visible");
    await expect(focused).toBeVisible();
    const tag = await focused.evaluate((element) => element.tagName);
    expect(["A", "BUTTON", "INPUT"]).toContain(tag);
  });

  test("unknown hash routes fall back to the main menu", async ({ page }) => {
    await gotoRoute(page, "#/not-a-real-mode");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/guitar/i);
  });
});
