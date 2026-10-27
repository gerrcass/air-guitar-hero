import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { gotoRoute, startRunFromGate } from "../e2e/helpers";

async function expectAxeClean(page: import("@playwright/test").Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.help}`)
    .join("\n");
  expect(results.violations, summary).toEqual([]);
}

test.describe("accessibility", () => {
  test("menu surfaces are axe-clean", async ({ page }) => {
    for (const hash of ["#/", "#/quickplay", "#/career", "#/settings", "#/tutorial"]) {
      await gotoRoute(page, hash);
      await expectAxeClean(page);
    }
  });

  test("results are axe-clean", async ({ page }) => {
    await gotoRoute(page, "#/play/quickplay/neon-throttle/easy");
    await startRunFromGate(page);
    await page.evaluate(() => window.__AGH_TEST__?.completeRun?.());
    await page.waitForURL(/#\/results/);
    await expectAxeClean(page);
  });
});
