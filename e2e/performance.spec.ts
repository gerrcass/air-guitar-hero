import { expect, test } from "@playwright/test";
import { gotoRoute, startRunFromGate } from "../e2e/helpers";

test.describe("performance", () => {
  test("an Expert run with particles and autoplay holds a smooth frame budget", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoRoute(page, "#/play/quickplay/afterburner/expert");
    await startRunFromGate(page);
    await page.evaluate(() => window.__AGH_TEST__?.autoplay?.(30));
    await page.waitForTimeout(1800);

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

    console.log("performance sample", sample);
    expect(sample.fps).toBeGreaterThanOrEqual(55);
    expect(sample.longTasks.filter((duration) => duration > 100)).toEqual([]);
  });
});
