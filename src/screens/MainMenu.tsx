import { AlbumArt } from "../components/AlbumArt";
import { Stars } from "../components/Stars";
import { SONG_BY_ID, SONGS_BY_VENUE, VENUES } from "../content/songs";
import { nextCareerSong } from "../state/career";
import { careerStarTotal } from "../state/save";
import { useSave } from "../state/store";

const MODES = [
  {
    href: "#/career",
    label: "Career",
    kicker: "The long way up",
    copy: "Three venues, encores, per-difficulty stars, and six guitars to earn.",
  },
  {
    href: "#/quickplay",
    label: "Quickplay",
    kicker: "Any song, right now",
    copy: "All twelve tracks and every difficulty are open from the first visit.",
  },
  {
    href: "#/practice",
    label: "Practice",
    kicker: "Drill the hard part",
    copy: "Pick a section, slow it to 50%, loop it, and never fail out.",
  },
  {
    href: "#/faceoff",
    label: "Face-off",
    kicker: "Two players, one chart",
    copy: "Local split-screen with independent scores, streaks, and rock meters.",
  },
  {
    href: "#/tutorial",
    label: "Tutorial",
    kicker: "Learn the vocabulary",
    copy: "Notes, chords, sustains, star power, and HOPOs in five short reps.",
  },
] as const;

export function MainMenu(): React.JSX.Element {
  const save = useSave();
  const stars = careerStarTotal(save);
  const next = nextCareerSong(save, save.lastDifficulty);
  const featured = next ?? SONG_BY_ID.get("neon-throttle");
  const completedTutorial = save.tutorialComplete;

  return (
    <div className="menu-screen">
      <section className="menu-hero" aria-labelledby="menu-title">
        <div className="menu-hero__copy">
          <p className="eyebrow">Late-night arena · Original setlist</p>
          <h1 id="menu-title" className="menu-title">
            <span className="menu-title__air">Air</span>
            <span className="menu-title__guitar">Guitar</span>
            <span className="menu-title__hero">Hero</span>
          </h1>
          <p className="menu-hero__lede">
            Five lanes. Twelve original tracks. Hold the frets, hit the strum, and make the crowd
            believe it.
          </p>
          <div className="menu-hero__actions">
            <a className="btn btn-primary btn-hero" href="#/quickplay">
              <span className="btn-hero__kicker">Play now</span>
              <span className="btn-hero__label">Quickplay</span>
            </a>
            <a className="btn btn-secondary" href="#/career">
              {stars > 0 ? "Continue career" : "Start career"}
            </a>
            {!completedTutorial && (
              <a className="btn btn-ghost" href="#/tutorial">
                How to play
              </a>
            )}
          </div>
          <dl className="menu-stats">
            <div>
              <dt>Career stars</dt>
              <dd>{stars}</dd>
            </div>
            <div>
              <dt>Runs played</dt>
              <dd>{save.stats.runs}</dd>
            </div>
            <div>
              <dt>Setlist</dt>
              <dd>12 songs</dd>
            </div>
            <div>
              <dt>Difficulties</dt>
              <dd>4 ladders</dd>
            </div>
          </dl>
          <p className="menu-hero__note">
            Keyboard and gamepad are first-class. On a phone, menus work — gameplay needs keys.
          </p>
        </div>

        <div className="menu-hero__stage" aria-hidden="true">
          <div className="stage-rig">
            <span className="stage-rig__beam stage-rig__beam--1" />
            <span className="stage-rig__beam stage-rig__beam--2" />
            <span className="stage-rig__beam stage-rig__beam--3" />
            <span className="stage-rig__beam stage-rig__beam--4" />
            <div className="stage-rig__truss">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} className="stage-rig__light" />
              ))}
            </div>
            <div className="stage-rig__crowd">
              {Array.from({ length: 22 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </div>
          <div className="menu-feature">
            {featured && <AlbumArt song={featured} />}
            <div className="menu-feature__overlay">
              <span className="eyebrow">{next ? "Next in career" : "Setlist opener"}</span>
              <strong>{featured?.title ?? "Neon Throttle"}</strong>
              <span>{featured?.artist ?? "The Copperheads"}</span>
            </div>
          </div>
          <div className="stage-ticket">
            <span className="stage-ticket__row">
              <span>TONIGHT</span>
              <span>DOORS 8PM</span>
            </span>
            <strong>THE RUSTY ANCHOR</strong>
            <span className="stage-ticket__row">
              <span>3 VENUES</span>
              <span>ONE LAST ENCORE</span>
            </span>
          </div>
        </div>
      </section>

      <section className="mode-grid" aria-labelledby="modes-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose a room</p>
            <h2 id="modes-title">How do you want to play?</h2>
          </div>
          <p className="section-heading__aside">Everything is local. No account, no download.</p>
        </div>
        <div className="mode-grid__items">
          {MODES.map((mode, index) => (
            <a className="mode-card" href={mode.href} key={mode.href}>
              <span className="mode-card__index">0{index + 1}</span>
              <span className="mode-card__kicker">{mode.kicker}</span>
              <strong className="mode-card__label">{mode.label}</strong>
              <span className="mode-card__copy">{mode.copy}</span>
              <span className="mode-card__arrow" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="venue-strip" aria-labelledby="venues-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The tour</p>
            <h2 id="venues-title">Three stages, twelve songs</h2>
          </div>
          <a className="text-link" href="#/career">
            See the career map →
          </a>
        </div>
        <div className="venue-strip__items">
          {VENUES.map((venue) => {
            const songs = SONGS_BY_VENUE[venue.id];
            return (
              <article className="venue-preview" key={venue.id}>
                <div
                  className="venue-preview__swatch"
                  style={{
                    background: `linear-gradient(135deg, ${venue.palette.primary}, ${venue.palette.secondary})`,
                  }}
                  aria-hidden="true"
                />
                <span className="eyebrow">{songs.length} songs · encore included</span>
                <h3>{venue.name}</h3>
                <p>{venue.tagline}</p>
                <ul className="venue-preview__songs">
                  {songs.map((song) => (
                    <li key={song.id}>
                      <span>{song.title}</span>
                      <span className="venue-preview__artist">{song.artist}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-progress" aria-labelledby="progress-title">
        <div>
          <p className="eyebrow">Your room</p>
          <h2 id="progress-title">The save on this device</h2>
          <p>
            {stars > 0
              ? `You have earned ${stars} career stars across ${save.stats.runs} runs. Keep clearing songs to unlock the next venue and the guitar locker.`
              : "Nothing earned yet. The first song is open in every difficulty; quickplay has the whole setlist unlocked."}
          </p>
        </div>
        <div className="home-progress__best">
          <Stars value={Math.min(5, Math.round(stars / 8))} label={`${stars} career stars`} />
          <span>{save.tutorialComplete ? "Tutorial complete" : "Tutorial not started"}</span>
          <a className="text-link" href="#/settings">
            Settings &amp; calibration →
          </a>
        </div>
      </section>
    </div>
  );
}
