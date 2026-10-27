# Release checklist

Release: **1.0.0** · spec #1 · tickets #2–#11
Repository: `gerrcass/air-guitar-hero`
Live target: <https://gerrcass.github.io/air-guitar-hero/>

## Pre-merge gates

| Gate | Command / source | Result |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` | Pass |
| Biome lint/format | `npm run lint` | Pass (warnings only) |
| Unit tests | `npm run test` | 98 tests, 10 files |
| Content validation | `npm run validate:content` | 12 songs × 4 charts |
| Browser journeys | `npm run test:e2e` | 32 Playwright tests |
| Accessibility scans | `e2e/axe.spec.ts` | 0 axe violations on menu, quickplay, career, settings, tutorial, results |
| Performance | `e2e/performance.spec.ts` | 59.9 fps median locally, 16.7 ms frame time, no long tasks >100 ms; CI relative gate |
| Production build | `npm run build` | 396 kB JS / 119 kB gzip, 56 kB CSS / 11.5 kB gzip |
| Pages base path | `vite preview` at `/air-guitar-hero/` | Pass |
| Screenshots | `npm run screenshots` | `docs/screenshots/*.png` |

## Deployment verification (post-merge)

| Check | Evidence | Result |
| --- | --- | --- |
| Pages workflow on `main` | [run 40441325728](https://github.com/gerrcass/air-guitar-hero/actions/runs/40441325728) | Success |
| Live URL returns the app | `https://gerrcass.github.io/air-guitar-hero/` returned HTTP 200 | Verified |
| Built game loads | live Playwright smoke: title `Air Guitar Hero`, Quickplay/Hard run started, score advanced to 950, no console/page errors | Verified |
| Live screenshot captured | live menu + live gameplay attached to [PR #12](https://github.com/gerrcass/air-guitar-hero/pull/12) | Verified |
| PR CI on merged head | [run 40439315640](https://github.com/gerrcass/air-guitar-hero/actions/runs/40439315640) | Success |
| Squash merge | `ffd1376c139e380f8997e913619e6236e6779312` | Merged |

## Repository hygiene

- [x] All ten tickets closed with merge/evidence comments.
- [x] Spec issue #1 closed with delivery summary.
- [x] No open pull requests.
- [x] Implementation worktrees removed.
- [x] Temporary ticket branches deleted.
- [x] Working tree clean; `dist/`, `node_modules/`, Playwright output, and scratch captures ignored.
- [x] Default branch is the final deployed state.
- [x] README live link and gameplay screenshot committed.

## Asset and licence statement

All music, arrangements, charts, album art, stage visuals, and icons are original project work.
The soundtrack is synthesized at runtime from deterministic song data; no recorded audio or
third-party artwork is bundled. Bebas Neue and Space Grotesk are self-hosted under the SIL Open
Font License. The project code is MIT. No Guitar Hero catalogue, logo, or protected expression is
used.
