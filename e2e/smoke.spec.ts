import { expect, type Page, test } from "@playwright/test";
import { expectNoConsoleErrors, gotoRoute, trackConsole } from "../e2e/helpers";

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function expectCompleteTabWalk(page: Page, hash: string): Promise<void> {
  // Start from a fresh document so sequential focus starts at the top of this route
  // rather than continuing from the previous route's last focused link.
  await page.goto("about:blank");
  await gotoRoute(page, hash);
  const stops = await page.evaluate((selector) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
    );
    return nodes.map((element, index) => {
      element.dataset.tabProbe = String(index);
      return element.tagName;
    });
  }, TABBABLE);
  expect(stops.length, `tab stops on ${hash}`).toBeGreaterThan(10);

  for (let index = 0; index < stops.length; index += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      const labelledBy = element.getAttribute("aria-labelledby");
      const candidates = [
        element.getAttribute("aria-label"),
        labelledBy ? document.getElementById(labelledBy)?.textContent : null,
        (element as HTMLInputElement).labels?.[0]?.textContent,
        element.textContent,
        element.getAttribute("title"),
      ];
      const name =
        candidates
          .map((value) => value?.replace(/\s+/g, " ").trim() ?? "")
          .find((value) => value.length > 0) ?? "";
      return {
        probe: element.dataset.tabProbe ?? null,
        focusVisible: element.matches(":focus-visible"),
        name,
      };
    });
    expect(focused?.probe, `tab stop ${index} on ${hash}`).toBe(String(index));
    expect(focused?.focusVisible, `focus ring at tab stop ${index} on ${hash}`).toBe(true);
    expect(focused?.name, `accessible name at tab stop ${index} on ${hash}`).not.toBe("");
  }
}

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

  test("Tab reaches every visible control in order with a name and focus ring", async ({
    page,
  }) => {
    await expectCompleteTabWalk(page, "#/");
    await expectCompleteTabWalk(page, "#/settings");
  });

  test("unknown routes and invalid song ids fall back safely", async ({ page }) => {
    await gotoRoute(page, "#/not-a-real-mode");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/guitar/i);
    await gotoRoute(page, "#/play/quickplay/not-a-song/easy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/guitar/i);
    await gotoRoute(page, "#/%E0%A4%A");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/guitar/i);
  });

  test("skip to content stays on the route and focuses main", async ({ page }) => {
    await gotoRoute(page, "#/settings");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/settings/);
    await expect(page.locator("main")).toBeFocused();
  });
});
