import { composeSong, validateChart } from "../src/content/composer";
import { SONGS, SONGS_BY_VENUE, VENUES } from "../src/content/songs";
import { TUTORIAL_LESSONS } from "../src/content/tutorial";
import { DIFFICULTIES } from "../src/game/types";

const problems: string[] = [];
const summary: string[] = [];

if (SONGS.length !== 12) problems.push(`Expected 12 songs, found ${SONGS.length}`);
if (VENUES.length !== 3) problems.push(`Expected 3 venues, found ${VENUES.length}`);
for (const venue of VENUES) {
  const songs = SONGS_BY_VENUE[venue.id];
  if (songs.length !== 4)
    problems.push(`${venue.name} must have four songs, found ${songs.length}`);
}

for (const song of SONGS) {
  const composed = composeSong(song);
  const regenerated = composeSong(song);
  if (JSON.stringify(composed.charts) !== JSON.stringify(regenerated.charts)) {
    problems.push(`${song.title}: charts are not deterministic`);
  }
  if (JSON.stringify(composed.arrangement) !== JSON.stringify(regenerated.arrangement)) {
    problems.push(`${song.title}: arrangement is not deterministic`);
  }
  const difficultyCounts: string[] = [];
  for (const difficulty of DIFFICULTIES) {
    const chart = composed.charts[difficulty];
    const chartProblems = validateChart(chart, song);
    problems.push(...chartProblems.map((problem) => `${song.title}: ${problem}`));
    if (chart.notes.length === 0) problems.push(`${song.title}/${difficulty}: no notes`);
    difficultyCounts.push(`${difficulty}=${chart.notes.length}`);
  }
  if (composed.charts.easy.notes.length >= composed.charts.expert.notes.length) {
    problems.push(`${song.title}: Expert is not denser than Easy`);
  }
  if (composed.arrangement.events.length < 200) {
    problems.push(`${song.title}: arrangement is too sparse`);
  }
  let lastTime = -1;
  for (const event of composed.arrangement.events) {
    if (event.time < lastTime) problems.push(`${song.title}: audio events are unsorted`);
    lastTime = event.time;
  }
  summary.push(
    `${song.title.padEnd(22)} ${composed.arrangement.duration.toFixed(1)}s  ${difficultyCounts.join("  ")}`,
  );
}

for (const lesson of TUTORIAL_LESSONS) {
  if (lesson.chart.notes.length < 3) problems.push(`Tutorial ${lesson.title}: too few notes`);
  if (lesson.chart.notes[0] && lesson.chart.notes[0].time < 3) {
    problems.push(`Tutorial ${lesson.title}: no approach lead-in`);
  }
}

if (problems.length > 0) {
  console.error(`Content validation failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Content validation passed: ${SONGS.length} songs × ${DIFFICULTIES.length} charts.`);
  for (const line of summary) console.log(`  ${line}`);
}
