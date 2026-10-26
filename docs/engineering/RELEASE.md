# Release checklist

Release: **1.0.0** · spec #1 · tickets #2–#11
Repository: `gerrcass/air-guitar-hero`
Live target: <https://gerrcass.github.io/air-guitar-hero/>

## Pre-merge gates

| Gate | Command / source | Result |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` | Pass |
| Biome lint/format | `npm run lint` | Pass (warnings only) |
| Unit tests | `npm run test` | 94 tests, 10 files |
| Content validation | `npm run validate:content` | 12 songs × 4 charts |
| Browser journeys | `npm run test:e2e` | 30 Playwright tests |
| Accessibility scans | `e2e/axe.spec.ts` | 0 axe violations on menu, quickplay, career, settings, tutorial, results |
| Performance | `e2e/performance.spec.ts` | median 59.9 fps, 16.7 ms frame time, no long tasks >100 ms |
| Production build | `npm run build` | 395 kB JS / 118 kB gzip, 56 kB CSS / 11.5 kB gzip |
| Pages base path | `vite preview` at `/air-guitar-hero/` | Pass |
| Screenshots | `npm run screenshots` | `docs/screenshots/*.png` |

## Deployment verification (post-merge)

| Check | Evidence | Result |
| --- | --- | --- |
| Pages workflow on `main` | GitHub Actions run | Pending merge |
| Live URL returns the app | `curl -I` / browser | Pending merge |
| Built game loads | live Playwright smoke | Pending merge |
| Live screenshot captured | `docs/screenshots/live-pages.png` (attach to PR) | Pending merge |

## Repository hygiene

- [ ] All ten tickets closed with merge/evidence comments.
- [ ] Spec issue #1 closed with delivery summary.
- [ ] No open pull requests.
- [ ] Implementation worktrees removed.
- [ ] Temporary ticket branches deleted.
- [ ] Working tree clean; `dist/`, `node_modules/`, Playwright output, and scratch captures ignored.
- [ ] Default branch is the final deployed state.
- [ ] README live link and gameplay screenshot committed.

## Asset and licence statement

All music, arrangements, charts, album art, stage visuals, and icons are original project work.
The soundtrack is synthesized at runtime from deterministic song data; no recorded audio or
third-party artwork is bundled. Bebas Neue and Space Grotesk are self-hosted under the SIL Open
Font License. The project code is MIT. No Guitar Hero catalogue, logo, or protected expression is
used.
