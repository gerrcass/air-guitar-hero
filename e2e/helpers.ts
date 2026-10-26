import { expect, type Page } from "@playwright/test";

export interface ConsoleTracker {
  readonly errors: string[];
}

export function trackConsole(page: Page): ConsoleTracker {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`PAGEERROR: ${error.message}`));
  return { errors };
}

export async function gotoRoute(page: Page, hash: string): Promise<void> {
  await page.goto(`/air-guitar-hero/?e2e=1${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
}

export async function startRunFromGate(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.locator(".highway-canvas")).toBeVisible();
  await page.waitForTimeout(250);
}

export async function pauseAndEnd(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Run paused" })).toBeVisible();
  await page.getByRole("button", { name: /End run & see results/ }).click();
  await expect(page).toHaveURL(/#\/results/);
}

export function expectNoConsoleErrors(tracker: ConsoleTracker): void {
  expect(tracker.errors, tracker.errors.join("\n")).toEqual([]);
}
