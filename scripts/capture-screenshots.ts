import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Page } from "@playwright/test";

const PORT = 4318;
const BASE = `http://localhost:${PORT}/air-guitar-hero/`;
const OUT = "docs/screenshots";

async function waitForServer(url: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function goto(page: Page, hash: string): Promise<void> {
  await page.goto(`${BASE}?e2e=1${hash}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function startRun(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start run" }).click();
  await page.waitForTimeout(450);
}

async function screenshot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled", fullPage });
  console.log(`captured ${OUT}/${name}.png`);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const build = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (build.status !== 0) throw new Error("Production build failed");

  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"],
    { stdio: "ignore" },
  );

  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("PAGEERROR", error.message));

    // Main menu from a save with progress.
    await goto(page, "#/play/career/neon-throttle/hard");
    await startRun(page);
    await page.evaluate(() => window.__AGH_TEST__?.completeRun?.());
    await page.waitForURL(/#\/results/);
    await page.waitForTimeout(500);
    await screenshot(page, "results", true);

    await goto(page, "#/career");
    await screenshot(page, "career");

    await goto(page, "#/");
    await screenshot(page, "menu");

    // A live Expert run with autoplay for a representative highway frame.
    await goto(page, "#/play/quickplay/afterburner/hard");
    await startRun(page);
    await page.evaluate(() => window.__AGH_TEST__?.autoplay?.(60));
    await page.waitForTimeout(20_000);
    await screenshot(page, "gameplay");

    // Two-player evidence with both players alive and scoring.
    await goto(page, "#/faceoff");
    await page.getByRole("button", { name: /Start face-off/ }).click();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__AGH_TEST__?.autoplay?.(40));
    await page.waitForTimeout(11_000);
    await screenshot(page, "faceoff");
    await page.evaluate(() => window.__AGH_TEST__?.finishRun?.());
    await page.waitForTimeout(400);
    await screenshot(page, "faceoff-results");

    await goto(page, "#/settings");
    await screenshot(page, "settings");

    await goto(page, "#/tutorial");
    await screenshot(page, "tutorial");

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${BASE}?e2e=1#/`, { waitUntil: "networkidle" });
    await mobilePage.evaluate(() => document.fonts.ready);
    await screenshot(mobilePage, "mobile-menu");
    await mobile.close();
    await context.close();
    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
