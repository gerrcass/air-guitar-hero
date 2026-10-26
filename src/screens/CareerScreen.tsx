import { useState } from "react";
import { DifficultyPicker, difficultyLabel } from "../components/DifficultyPicker";
import { GuitarArt } from "../components/GuitarArt";
import { SongCard } from "../components/SongCard";
import { Stars } from "../components/Stars";
import { SONGS_BY_VENUE, songById, VENUES } from "../content/songs";
import type { Difficulty } from "../game/types";
import {
  careerSongsForVenue,
  difficultyStars,
  isSongUnlocked,
  isVenueUnlocked,
  nextCareerSong,
} from "../state/career";
import { GUITAR_FINISHES, unlockedGuitarsForStars } from "../state/cosmetics";
import { playHref } from "../state/router";
import { careerStarTotal } from "../state/save";
import { saveStore, useSave } from "../state/store";

export function CareerScreen(): React.JSX.Element {
  const save = useSave();
  const [difficulty, setDifficulty] = useState<Difficulty>(save.lastDifficulty);
  const next = nextCareerSong(save, difficulty);
  const [selectedId, setSelectedId] = useState<string | null>(
    next?.id ?? SONGS_BY_VENUE["rusty-anchor"][0]?.id ?? null,
  );
  const selected = selectedId ? songById(selectedId) : null;
  const selectedUnlocked = selected ? isSongUnlocked(save, difficulty, selected.id) : false;
  const totalStars = careerStarTotal(save);
  const unlocked = unlockedGuitarsForStars(totalStars);
  const nextGuitar = GUITAR_FINISHES.find((guitar) => !unlocked.includes(guitar.id));
  const equipped = save.equippedGuitar;

  const chooseDifficulty = (nextDifficulty: Difficulty): void => {
    setDifficulty(nextDifficulty);
    const candidate = nextCareerSong(save, nextDifficulty);
    setSelectedId(candidate?.id ?? SONGS_BY_VENUE["rusty-anchor"][0]?.id ?? null);
    saveStore.rememberSelection("career", nextDifficulty, candidate?.id ?? save.lastSongId);
  };

  return (
    <div className="screen career-screen">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Career</p>
          <h1>Three rooms. Four songs each.</h1>
          <p>
            Clear songs in order, then the encore, then the next venue. Progress is separate on
            every difficulty and every star counts toward the locker.
          </p>
        </div>
        <div className="career-summary">
          <span className="career-summary__stars">{totalStars}</span>
          <span className="career-summary__label">career stars</span>
          <Stars
            value={Math.min(5, Math.floor(totalStars / 8))}
            label={`${totalStars} career stars`}
          />
        </div>
      </header>

      <div className="career-toolbar">
        <DifficultyPicker value={difficulty} onChange={chooseDifficulty} compact />
        <div className="career-toolbar__stars">
          <span className="eyebrow">{difficultyLabel(difficulty)} stars</span>
          <strong>{difficultyStars(save, difficulty)} / 60</strong>
        </div>
        {next ? (
          <a className="btn btn-primary" href={playHref("career", next.id, difficulty)}>
            Play next: {next.title}
          </a>
        ) : (
          <span className="career-toolbar__done">
            Every venue cleared on {difficultyLabel(difficulty)}.
          </span>
        )}
      </div>

      <div className="career-layout">
        <div className="career-venues">
          {VENUES.map((venue, venueIndex) => {
            const venueUnlocked = isVenueUnlocked(save, difficulty, venue.id);
            const songs = careerSongsForVenue(save, difficulty, venue.id);
            const cleared = songs.filter((song) => song.cleared).length;
            return (
              <section
                className="venue-section"
                key={venue.id}
                aria-labelledby={`venue-${venue.id}`}
              >
                <div className="venue-section__header">
                  <div className="venue-section__title">
                    <span className="venue-section__number">0{venueIndex + 1}</span>
                    <div>
                      <p className="eyebrow">
                        {venueUnlocked ? "Unlocked" : "Locked"} · {cleared}/4 cleared
                      </p>
                      <h2 id={`venue-${venue.id}`}>{venue.name}</h2>
                      <p>{venue.description}</p>
                    </div>
                  </div>
                  <div
                    className="venue-section__swatch"
                    style={{
                      background: `linear-gradient(135deg, ${venue.palette.primary}, ${venue.palette.secondary})`,
                    }}
                    aria-hidden="true"
                  />
                </div>
                {!venueUnlocked && (
                  <p className="venue-lock">
                    Locked on {difficultyLabel(difficulty)} — clear the encore at{" "}
                    {VENUES[venueIndex - 1]?.name ?? "the previous venue"} first.
                  </p>
                )}
                <div className="song-grid song-grid--career">
                  {songs.map((entry) => (
                    <div key={entry.song.id} className={entry.index === 3 ? "encore-wrap" : ""}>
                      {entry.index === 3 && <span className="encore-badge">Encore</span>}
                      <SongCard
                        song={entry.song}
                        selected={selectedId === entry.song.id}
                        onSelect={
                          entry.unlocked
                            ? () => {
                                setSelectedId(entry.song.id);
                                saveStore.rememberSelection("career", difficulty, entry.song.id);
                              }
                            : undefined
                        }
                        bestStars={entry.stars}
                        bestScore={save.best[`${entry.song.id}:${difficulty}`]?.score ?? 0}
                        lockedReason={
                          entry.unlocked
                            ? null
                            : (entry.lockReason ?? "Clear earlier songs to unlock")
                        }
                        showGenre={false}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="career-panel" aria-label="Selected career song">
          {selected ? (
            <>
              <p className="eyebrow">{selected.venueId.replace("-", " ")}</p>
              <h2>{selected.title}</h2>
              <p className="career-panel__artist">{selected.artist}</p>
              <p className="career-panel__meta">
                {selected.genre} · {selected.bpm} BPM · rating {selected.difficultyRating}/10
              </p>
              <div className="career-panel__stars">
                <span>Best on {difficultyLabel(difficulty)}</span>
                <Stars
                  value={save.career[difficulty].cleared[selected.id] ?? 0}
                  label={`${save.career[difficulty].cleared[selected.id] ?? 0} of 5 stars`}
                />
              </div>
              {selectedUnlocked ? (
                <a
                  className="btn btn-primary btn-block"
                  href={playHref("career", selected.id, difficulty)}
                >
                  Play “{selected.title}”
                </a>
              ) : (
                <p className="quiet-note">
                  This song is locked on {difficultyLabel(difficulty)}. Clear the songs before it or
                  switch difficulty.
                </p>
              )}
              <p className="quiet-note">
                A failed career run saves no progress. Cleared songs can be replayed for a better
                star rating.
              </p>
            </>
          ) : (
            <p>Select a song.</p>
          )}
        </aside>
      </div>

      <section className="locker" aria-labelledby="locker-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The locker</p>
            <h2 id="locker-title">Six finishes, earned with stars</h2>
            <p>
              Career stars accumulate across difficulties. Equip a guitar finish here; it shows on
              the run gate before every performance.
            </p>
          </div>
          {nextGuitar && (
            <p className="locker__next">
              Next unlock: <strong>{nextGuitar.name}</strong> at {nextGuitar.threshold} stars
              <span className="quiet-note">
                {" "}
                ({Math.max(0, nextGuitar.threshold - totalStars)} to go)
              </span>
            </p>
          )}
        </div>
        <div className="locker__grid">
          {GUITAR_FINISHES.map((guitar) => {
            const isUnlocked = unlocked.includes(guitar.id);
            const isEquipped = equipped === guitar.id;
            return (
              <article
                className={`locker-card${isUnlocked ? "" : " locker-card--locked"}${
                  isEquipped ? " locker-card--equipped" : ""
                }`}
                key={guitar.id}
              >
                <div className="locker-card__art">
                  <GuitarArt guitar={guitar} />
                </div>
                <h3>{guitar.name}</h3>
                <p>{guitar.description}</p>
                <div className="locker-card__footer">
                  {isUnlocked ? (
                    <button
                      type="button"
                      className={`btn ${isEquipped ? "btn-ghost" : "btn-secondary"}`}
                      onClick={() => saveStore.setEquippedGuitar(guitar.id)}
                      aria-pressed={isEquipped}
                      disabled={isEquipped}
                    >
                      {isEquipped ? "Equipped" : "Equip"}
                    </button>
                  ) : (
                    <span className="locker-card__threshold">
                      ★ {guitar.threshold} career stars
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
