import { SONGS_BY_VENUE, VENUES } from "../content/songs";
import type { SongDefinition, VenueDefinition, VenueId } from "../content/types";
import type { Difficulty } from "../game/types";
import { unlockedGuitarsForStars } from "./cosmetics";
import { type BestRun, bestKey, careerStarTotal, type GameMode, type SaveData } from "./save";

export interface CareerSongView {
  readonly song: SongDefinition;
  readonly venue: VenueDefinition;
  readonly index: number;
  readonly unlocked: boolean;
  readonly stars: number;
  readonly cleared: boolean;
  readonly lockReason: string | null;
}

export interface RunResult {
  readonly mode: GameMode;
  readonly songId: string;
  readonly difficulty: Difficulty;
  readonly score: number;
  readonly parScore: number;
  readonly passed: boolean;
  readonly accuracy: number;
  readonly maxStreak: number;
  readonly notesHit: number;
}

export interface RecordedRun {
  readonly save: SaveData;
  readonly stars: number;
  readonly newBest: boolean;
  readonly previousBest: BestRun | null;
}

export function starsForScore(score: number, parScore: number, passed: boolean): number {
  if (!passed) return 0;
  const ratio = parScore > 0 ? score / parScore : 0;
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.55) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

export function venueOrderIndex(venueId: string): number {
  return VENUES.findIndex((venue) => venue.id === venueId);
}

export function songLocation(songId: string): { venue: VenueDefinition; index: number } | null {
  for (const venue of VENUES) {
    const songs = SONGS_BY_VENUE[venue.id];
    const index = songs.findIndex((song) => song.id === songId);
    if (index >= 0) return { venue, index };
  }
  return null;
}

export function isVenueUnlocked(save: SaveData, difficulty: Difficulty, venueId: string): boolean {
  const index = venueOrderIndex(venueId);
  if (index <= 0) return index === 0;
  const previous = VENUES[index - 1];
  if (!previous) return false;
  const previousSongs = SONGS_BY_VENUE[previous.id];
  const encore = previousSongs[previousSongs.length - 1];
  if (!encore) return false;
  return (save.career[difficulty].cleared[encore.id] ?? 0) > 0;
}

export function lockReasonFor(
  save: SaveData,
  difficulty: Difficulty,
  songId: string,
): string | null {
  const location = songLocation(songId);
  if (!location) return "Unknown song";
  const { venue, index } = location;
  if (!isVenueUnlocked(save, difficulty, venue.id)) {
    return `Clear the previous venue's encore to unlock ${venue.name}.`;
  }
  const cleared = save.career[difficulty].cleared;
  if (index === 0) return null;
  if (index === 3) {
    const regular = SONGS_BY_VENUE[venue.id].slice(0, 3);
    if (regular.every((song) => (cleared[song.id] ?? 0) > 0)) return null;
    return "Clear all three songs in this venue to unlock the encore.";
  }
  const previous = SONGS_BY_VENUE[venue.id][index - 1];
  if (previous && (cleared[previous.id] ?? 0) > 0) return null;
  return previous ? `Clear "${previous.title}" to unlock this song.` : "Locked";
}

export function isSongUnlocked(save: SaveData, difficulty: Difficulty, songId: string): boolean {
  return lockReasonFor(save, difficulty, songId) === null;
}

export function careerSongsForVenue(
  save: SaveData,
  difficulty: Difficulty,
  venueId: string,
): CareerSongView[] {
  const venue = VENUES.find((candidate) => candidate.id === venueId);
  if (!venue) return [];
  return SONGS_BY_VENUE[venue.id].map((song, index) => {
    const stars = save.career[difficulty].cleared[song.id] ?? 0;
    return {
      song,
      venue,
      index,
      unlocked: isSongUnlocked(save, difficulty, song.id),
      stars,
      cleared: stars > 0,
      lockReason: lockReasonFor(save, difficulty, song.id),
    };
  });
}

export function venueStars(save: SaveData, difficulty: Difficulty, venueId: VenueId): number {
  return (
    SONGS_BY_VENUE[venueId]?.reduce(
      (sum, song) => sum + (save.career[difficulty].cleared[song.id] ?? 0),
      0,
    ) ?? 0
  );
}

export function difficultyStars(save: SaveData, difficulty: Difficulty): number {
  let total = 0;
  for (const venue of VENUES) {
    total += venueStars(save, difficulty, venue.id);
  }
  return total;
}

export function nextCareerSong(save: SaveData, difficulty: Difficulty): SongDefinition | null {
  for (const venue of VENUES) {
    if (!isVenueUnlocked(save, difficulty, venue.id)) continue;
    for (const song of SONGS_BY_VENUE[venue.id]) {
      if ((save.career[difficulty].cleared[song.id] ?? 0) === 0) {
        if (isSongUnlocked(save, difficulty, song.id)) return song;
      }
    }
  }
  return null;
}

export function recordRun(save: SaveData, result: RunResult): RecordedRun {
  const stars = starsForScore(result.score, result.parScore, result.passed);
  if (result.mode !== "career" && result.mode !== "quickplay") {
    return { save, stars, newBest: false, previousBest: null };
  }

  const key = bestKey(result.songId, result.difficulty);
  const previousBest = save.best[key] ?? null;
  const isBest = result.passed && (!previousBest || result.score > previousBest.score);

  const nextCareer: Record<Difficulty, { cleared: Record<string, number> }> = {
    easy: { cleared: { ...save.career.easy.cleared } },
    medium: { cleared: { ...save.career.medium.cleared } },
    hard: { cleared: { ...save.career.hard.cleared } },
    expert: { cleared: { ...save.career.expert.cleared } },
  };
  if (result.mode === "career" && result.passed && stars > 0) {
    const difficultyCareer = nextCareer[result.difficulty];
    difficultyCareer.cleared[result.songId] = Math.max(
      difficultyCareer.cleared[result.songId] ?? 0,
      stars,
    );
  }

  const nextBest: Record<string, BestRun> = { ...save.best };
  if (result.passed) {
    const merged: BestRun = {
      score: Math.max(previousBest?.score ?? 0, result.score),
      stars: Math.max(previousBest?.stars ?? 0, stars),
      accuracy: Math.max(previousBest?.accuracy ?? 0, result.accuracy),
      maxStreak: Math.max(previousBest?.maxStreak ?? 0, result.maxStreak),
    };
    nextBest[key] = merged;
  }

  const career = nextCareer;
  const totalStars = careerStarTotal({ career });
  const unlockedGuitars = [
    ...new Set([...unlockedGuitarsForStars(totalStars), ...save.unlockedGuitars]),
  ];
  const nextSave: SaveData = {
    ...save,
    career,
    best: nextBest,
    unlockedGuitars,
    stats: {
      runs: save.stats.runs + 1,
      notesHit: save.stats.notesHit + Math.max(0, result.notesHit),
      stars: totalStars,
    },
    lastMode: result.mode,
    lastDifficulty: result.difficulty,
    lastSongId: result.songId,
  };
  return { save: nextSave, stars, newBest: isBest, previousBest };
}

export function markTutorialComplete(save: SaveData): SaveData {
  if (save.tutorialComplete) return save;
  return { ...save, tutorialComplete: true };
}

export function careerStarSummary(save: SaveData): {
  total: number;
  byDifficulty: Record<Difficulty, number>;
} {
  return {
    total: careerStarTotal(save),
    byDifficulty: {
      easy: difficultyStars(save, "easy"),
      medium: difficultyStars(save, "medium"),
      hard: difficultyStars(save, "hard"),
      expert: difficultyStars(save, "expert"),
    },
  };
}
