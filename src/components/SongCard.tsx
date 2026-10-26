import type { SongDefinition } from "../content/types";
import type { Difficulty } from "../game/types";
import { AlbumArt } from "./AlbumArt";
import { Stars } from "./Stars";

interface SongCardProps {
  readonly song: SongDefinition;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
  readonly bestStars?: number;
  readonly bestScore?: number;
  readonly difficulty?: Difficulty;
  readonly lockedReason?: string | null;
  readonly showGenre?: boolean;
}

function formatScore(score: number): string {
  return new Intl.NumberFormat("en-US").format(score);
}

function ratingDots(rating: number): string {
  return "●".repeat(Math.max(1, Math.min(10, Math.round(rating))));
}

export function SongCard({
  song,
  selected = false,
  onSelect,
  bestStars = 0,
  bestScore = 0,
  lockedReason = null,
  showGenre = true,
}: SongCardProps): React.JSX.Element {
  const content = (
    <>
      <span className="song-card__art">
        <AlbumArt song={song} />
        <span className="song-card__rating" title={`Career difficulty ${song.difficultyRating}/10`}>
          {ratingDots(song.difficultyRating)}
        </span>
        {lockedReason && <span className="song-card__lock">Locked</span>}
      </span>
      <span className="song-card__body">
        <span className="song-card__title">{song.title}</span>
        <span className="song-card__artist">{song.artist}</span>
        {showGenre && (
          <span className="song-card__meta">
            {song.genre} · {song.year}
          </span>
        )}
        <span className="song-card__stats">
          {lockedReason ? (
            <span className="song-card__locked-text">{lockedReason}</span>
          ) : (
            <>
              <Stars value={bestStars} label={`${bestStars} of 5 best stars`} />
              <span className="song-card__best">
                {bestScore > 0 ? formatScore(bestScore) : "No run yet"}
              </span>
            </>
          )}
        </span>
      </span>
    </>
  );

  if (!onSelect || lockedReason) {
    return (
      <article
        className={`song-card${selected ? " song-card--selected" : ""}${
          lockedReason ? " song-card--locked" : ""
        }`}
        aria-disabled={lockedReason ? true : undefined}
      >
        {content}
      </article>
    );
  }

  return (
    <button
      type="button"
      className={`song-card${selected ? " song-card--selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {content}
    </button>
  );
}
