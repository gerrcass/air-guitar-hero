import { expect, test } from "@playwright/test";
import { gotoRoute, startRunFromGate } from "../e2e/helpers";

test.describe("performance", () => {
  test("an Expert run with particles and autoplay holds a smooth frame budget", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoRoute(page, "#/play/quickplay/afterburner/expert");
    await startRunFromGate(page);
    await page.waitForTimeout(500);

    // Measure the display's idle cadence first. Shared CI runners often run Chromium at 30 Hz;
    // the absolute 55 fps gate is enforced locally, while CI checks that gameplay does not
    // collapse relative to the available frame cadence.
    const baseline = await page.evaluate(async () => {
      const start = performance.now();
      const deltas: number[] = [];
      let previous = start;
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          deltas.push(now - previous);
          previous = now;
          if (now - start < 1200) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      const sorted = [...deltas].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 16.7;
      return { fps: 1000 / median, medianDeltaMs: median };
    });

    await page.evaluate(() => window.__AGH_TEST__?.autoplay?.(30));
    await page.waitForTimeout(800);

    const sample = await page.evaluate(async () => {
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      try {
        observer.observe({ type: "longtask", buffered: false });
      } catch {
        // Long Task Timing is not available in every browser build.
      }
      const start = performance.now();
      let worst = 0;
      let previous = start;
      const deltas: number[] = [];
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          deltas.push(now - previous);
          worst = Math.max(worst, now - previous);
          previous = now;
          if (now - start < 5000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      observer.disconnect();
      const elapsed = performance.now() - start;
      const sorted = [...deltas].sort((a, b) => a - b);
      const medianDelta = sorted[Math.floor(sorted.length / 2)] ?? 16.7;
      const averageFps = (deltas.length / elapsed) * 1000;
      return {
        fps: 1000 / medianDelta,
        averageFps,
        medianDeltaMs: medianDelta,
        worstGapMs: worst,
        longTasks,
      };
    });

    console.log("performance baseline", baseline, "sample", sample);
    const relative = sample.fps / Math.max(1, baseline.fps);
    expect(sample.longTasks.filter((duration) => duration > 100)).toEqual([]);
    expect(sample.worstGapMs).toBeLessThan(200);
    if (process.env.CI) {
      expect(relative).toBeGreaterThanOrEqual(0.75);
    } else {
      expect(sample.fps).toBeGreaterThanOrEqual(55);
    }
  });
});
