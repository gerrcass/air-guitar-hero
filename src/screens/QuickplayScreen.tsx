import { useState } from "react";
import { AlbumArt } from "../components/AlbumArt";
import { DifficultyPicker, difficultyLabel } from "../components/DifficultyPicker";
import { SongCard } from "../components/SongCard";
import { Stars } from "../components/Stars";
import { SONGS, SONGS_BY_VENUE, VENUES } from "../content/songs";
import type { Difficulty } from "../game/types";
import { playHref } from "../state/router";
import { bestKey } from "../state/save";
import { saveStore, useSave } from "../state/store";

function formatScore(score: number): string {
  return new Intl.NumberFormat("en-US").format(score);
}

export function QuickplayScreen(): React.JSX.Element {
  const save = useSave();
  const [difficulty, setDifficulty] = useState<Difficulty>(save.lastDifficulty);
  const initialSong =
    save.lastSongId && SONGS.some((song) => song.id === save.lastSongId)
      ? save.lastSongId
      : (SONGS[0]?.id ?? "neon-throttle");
  const [selectedId, setSelectedId] = useState(initialSong);
  const selected = SONGS.find((song) => song.id === selectedId) ?? SONGS[0];

  if (!selected) {
    return <p>No songs available.</p>;
  }

  const best = save.best[bestKey(selected.id, difficulty)];
  const choose = (songId: string): void => {
    setSelectedId(songId);
    saveStore.rememberSelection("quickplay", difficulty, songId);
  };
  const chooseDifficulty = (next: Difficulty): void => {
    setDifficulty(next);
    saveStore.rememberSelection("quickplay", next, selected.id);
  };

  return (
    <div className="screen quickplay-screen">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Quickplay</p>
          <h1>The whole setlist is open</h1>
          <p>
            Twelve original tracks, four charts each. Pick a song, pick a difficulty, and the
            count-in takes care of the rest.
          </p>
        </div>
        <div className="screen-heading__badge">
          <span>{SONGS.length} tracks</span>
          <span>{VENUES.length} venues</span>
          <span>4 difficulties</span>
        </div>
      </header>

      <div className="quickplay-layout">
        <div className="quickplay-list">
          {VENUES.map((venue) => (
            <section className="quickplay-venue" key={venue.id} aria-labelledby={`qp-${venue.id}`}>
              <div className="quickplay-venue__header">
                <div>
                  <p className="eyebrow">{venue.name}</p>
                  <h2 id={`qp-${venue.id}`}>{venue.tagline}</h2>
                </div>
                <span
                  className="venue-dot"
                  style={{ background: venue.palette.primary }}
                  aria-hidden="true"
                />
              </div>
              <div className="song-grid">
                {SONGS_BY_VENUE[venue.id].map((song) => {
                  const songBest = save.best[bestKey(song.id, difficulty)];
                  return (
                    <SongCard
                      key={song.id}
                      song={song}
                      selected={song.id === selected.id}
                      onSelect={() => choose(song.id)}
                      bestStars={songBest?.stars ?? 0}
                      bestScore={songBest?.score ?? 0}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="quickplay-panel" aria-label="Selected song">
          <div className="quickplay-panel__art">
            <AlbumArt song={selected} />
          </div>
          <div className="quickplay-panel__body">
            <p className="eyebrow">
              {selected.genre} · {selected.album}
            </p>
            <h2>{selected.title}</h2>
            <p className="quickplay-panel__artist">{selected.artist}</p>
            <p className="quickplay-panel__meta">
              {selected.bpm} BPM · {selected.year} · Career rating {selected.difficultyRating}/10
            </p>
            <DifficultyPicker value={difficulty} onChange={chooseDifficulty} compact />
            <div className="quickplay-panel__best">
              <div>
                <span className="quickplay-panel__label">Best — {difficultyLabel(difficulty)}</span>
                {best ? (
                  <strong>{formatScore(best.score)}</strong>
                ) : (
                  <strong className="is-empty">No run yet</strong>
                )}
              </div>
              <Stars value={best?.stars ?? 0} label={`${best?.stars ?? 0} of 5 best stars`} />
            </div>
            {best && (
              <p className="quickplay-panel__record">
                {Math.round(best.accuracy * 100)}% accuracy · {best.maxStreak} best streak
              </p>
            )}
            <a
              className="btn btn-primary btn-block"
              href={playHref("quickplay", selected.id, difficulty)}
            >
              Play “{selected.title}”
            </a>
            <p className="quiet-note">
              Quickplay scores are saved to this device. Career progress only advances in Career.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
