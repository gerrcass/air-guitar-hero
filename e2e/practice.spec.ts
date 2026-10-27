import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, gotoRoute, startRunFromGate, trackConsole } from "../e2e/helpers";

async function setRange(page: import("@playwright/test").Page, value: number): Promise<void> {
  await page
    .locator('input[type="range"]')
    .first()
    .evaluate((element, next) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(next));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}

test.describe("practice", () => {
  test("offers real sections, speeds, loop and no-fail, and never writes bests", async ({
    page,
  }) => {
    const console = trackConsole(page);
    await gotoRoute(page, "#/practice");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/drill the part/i);
    const sectionSelect = page.locator("select").nth(1);
    await expect(sectionSelect).toBeVisible();
    const sectionOptions = await sectionSelect.locator("option").allTextContents();
    expect(sectionOptions.length).toBeGreaterThan(4);
    expect(sectionOptions.some((option) => option.includes("Chorus 1"))).toBe(true);

    for (const speed of [50, 75, 100]) {
      await setRange(page, speed);
      await expect(
        page.locator(".field__label").filter({ hasText: /Speed/ }).first(),
      ).toContainText(`${speed}%`);
    }

    await setRange(page, 100);
    await page.getByRole("link", { name: "Start practice" }).click();
    await expect(page.getByText(/100% speed/)).toBeVisible();
    await startRunFromGate(page);
    await expect(page.locator(".practice-run-bar")).toContainText("100%");
    await expect(page.locator(".practice-run-bar")).toContainText("loop on");

    // Intro is eight seconds; wait through one loop boundary at full speed.
    await page.waitForTimeout(11_000);
    await expect(page.locator(".practice-run-bar")).toContainText(/pass [23]/);

    await page.getByRole("button", { name: "Turn loop off" }).click();
    await expect(page.locator(".practice-run-bar")).toContainText("loop off");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Run paused" })).toBeVisible();
    await page.getByRole("button", { name: /End run & see results/ }).click();
    await page.waitForURL(/#\/results/);
    await expect(page.getByText("Practice rep — saves untouched.")).toBeVisible();

    const saved = await page.evaluate(() => {
      const raw = window.localStorage.getItem("air-guitar-hero.save.v1");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved?.best ?? {}).toEqual({});
    expect(saved?.career?.medium?.cleared?.["neon-throttle"]).toBeUndefined();
    expectNoConsoleErrors(console);
  });

  test("remembers the practice song and difficulty across reload", async ({ page }) => {
    await gotoRoute(page, "#/practice");
    const songSelect = page.locator("select").first();
    const options = await songSelect.locator("option").allTextContents();
    const gutter = options.findIndex((option) => option.includes("Gutter Halo"));
    expect(gutter).toBeGreaterThanOrEqual(0);
    await songSelect.selectOption({ index: gutter });
    await page
      .getByRole("group", { name: "Difficulty" })
      .getByRole("button", { name: /Hard/ })
      .click();
    await page.getByRole("link", { name: "Start practice" }).click();
    await gotoRoute(page, "#/practice");
    await expect(page.locator("select").first()).toHaveValue("gutter-halo");
    await expect(
      page.getByRole("group", { name: "Difficulty" }).getByRole("button", { name: /Hard/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("a 75% practice gate starts at the selected section speed", async ({ page }) => {
    await gotoRoute(page, "#/practice");
    await setRange(page, 75);
    const sectionSelect = page.locator("select").nth(1);
    const options = await sectionSelect.locator("option").allTextContents();
    const chorusIndex = options.findIndex((option) => option.includes("Chorus 1"));
    expect(chorusIndex).toBeGreaterThanOrEqual(0);
    await sectionSelect.selectOption({ index: chorusIndex });
    await page.getByRole("link", { name: "Start practice" }).click();
    await expect(page.getByText(/75% speed/)).toBeVisible();
    await expect(page.locator(".gate-panel .eyebrow")).toContainText(/Chorus 1/);
    await startRunFromGate(page);
    await expect(page.locator(".practice-run-bar")).toContainText("75%");
  });
});
