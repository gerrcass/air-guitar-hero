# Performance notes

Measured from the production build in headless Chromium on the development machine
(WSL2, Chromium via Playwright, 1440×900, device pixel ratio 1). The reproducible check lives
in `e2e/performance.spec.ts`.

## Expert run sample

Test: Quickplay → Afterburner → Expert, autoplay enabled so the highway carries a realistic
garden of gems, particles, score pops, and star-power events.

| Metric | Result |
| --- | --- |
| Median frame time | 16.7 ms |
| Median frame rate | 59.9 fps |
| Worst frame gap | 33.4 ms (one run: 66.6 ms) |
| Long tasks over 100 ms | 0 |
| Canvas device pixel ratio | capped at 2 in code; 1 in this capture |
| Bundle | 388 kB JS / 116 kB gzip; 55 kB CSS / 11 kB gzip |

The assertion in the browser suite is median ≥ 55 fps with no long tasks over 100 ms. The
renderer allocates one Canvas, pre-allocates particle and score-pop pools, caps DPR at 2, and
cancels its rAF loop when gameplay unmounts. React HUD state is sampled at roughly 11 Hz; the
Canvas reads snapshots directly every frame.

## Layout checks

The responsive browser test loads the menu, quickplay, career, and settings at 1280×720,
1440×900, 1920×1080, 2560×1080, and 820×1180 and asserts that no page overflows horizontally.
Face-off is separately checked at 1280×720: two labelled HUDs, no horizontal overlap, and both
highways visible.

To reproduce:

```sh
npm run test:e2e -- --grep "performance"
```
