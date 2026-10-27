import { useEffect, useMemo, useState } from "react";
import { AlbumArt } from "../components/AlbumArt";
import { DifficultyPicker, difficultyLabel } from "../components/DifficultyPicker";
import { getComposedSong } from "../content/composer";
import { SONGS, songById } from "../content/songs";
import type { Difficulty } from "../game/types";
import { playHref } from "../state/router";
import { saveStore, useSave } from "../state/store";

function formatTime(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function PracticeScreen(): React.JSX.Element {
  const save = useSave();
  const [songId, setSongId] = useState(
    save.lastSongId && SONGS.some((song) => song.id === save.lastSongId)
      ? save.lastSongId
      : (SONGS[0]?.id ?? "neon-throttle"),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(save.lastDifficulty);
  const song = songById(songId);
  const composed = getComposedSong(songId);
  const chart = composed.charts[difficulty];
  const sections = chart.sections.filter((section) => section.end - section.start >= 2);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);

  useEffect(() => {
    if (!sections.some((section) => section.id === sectionId)) {
      setSectionId(sections[0]?.id ?? "");
    }
  }, [sections, sectionId]);

  const section = useMemo(
    () => sections.find((candidate) => candidate.id === sectionId) ?? sections[0],
    [sections, sectionId],
  );
  const startHref = section
    ? playHref("practice", songId, difficulty, {
        sectionId: section.id,
        speed,
        loop,
      })
    : "#/practice";

  return (
    <div className="screen practice-screen">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Practice</p>
          <h1>Drill the part that keeps beating you</h1>
          <p>
            Start at any real chart section, slow it down, loop it, and play without failing.
            Practice never writes career progress or overwrites quickplay bests.
          </p>
        </div>
        <div className="screen-heading__badge">
          <span>50–100% speed</span>
          <span>Loop any section</span>
          <span>No fail</span>
        </div>
      </header>

      <div className="practice-layout">
        <section className="practice-form panel" aria-labelledby="practice-form-title">
          <h2 id="practice-form-title">Set up the rep</h2>
          <label className="field">
            <span className="field__label">Song</span>
            <select
              value={songId}
              onChange={(event) => {
                setSongId(event.target.value);
                setSectionId("");
              }}
            >
              {SONGS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title} — {option.artist}
                </option>
              ))}
            </select>
          </label>

          <DifficultyPicker value={difficulty} onChange={setDifficulty} compact />

          <label className="field">
            <span className="field__label">Section</span>
            <select
              value={section?.id ?? ""}
              onChange={(event) => setSectionId(event.target.value)}
            >
              {sections.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {formatTime(option.start)}–{formatTime(option.end)} (
                  {Math.round(option.end - option.start)}s)
                </option>
              ))}
            </select>
          </label>

          <label className="field field--range">
            <span className="field__label">
              Speed <strong>{Math.round(speed * 100)}%</strong>
            </span>
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={Math.round(speed * 100)}
              onChange={(event) => setSpeed(Number(event.target.value) / 100)}
              aria-valuetext={`${Math.round(speed * 100)} percent speed`}
            />
            <span className="field__hint">
              Tempo changes; pitch stays put. The hit window is measured in song time, so slow
              speeds are forgiving.
            </span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={loop}
              onChange={(event) => setLoop(event.target.checked)}
            />
            <span>
              <strong>Loop this section</strong>
              <span>Audio and chart state restart together at the section boundary.</span>
            </span>
          </label>

          <label className="toggle">
            <input type="checkbox" checked readOnly disabled />
            <span>
              <strong>No fail is always on</strong>
              <span>An empty rock meter never ends a practice run.</span>
            </span>
          </label>

          <a
            className="btn btn-primary btn-block"
            href={startHref}
            onClick={() => saveStore.rememberSelection("practice", difficulty, songId)}
          >
            Start practice
          </a>
        </section>

        <aside className="practice-preview panel" aria-label="Practice preview">
          <div className="practice-preview__art">
            <AlbumArt song={song} />
          </div>
          <p className="eyebrow">
            {song.genre} · {difficultyLabel(difficulty)}
          </p>
          <h2>{song.title}</h2>
          <p className="practice-preview__artist">{song.artist}</p>
          <dl className="practice-preview__facts">
            <div>
              <dt>Section</dt>
              <dd>{section?.name ?? "Full song"}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>
                {section
                  ? `${Math.round(section.end - section.start)}s`
                  : `${Math.round(chart.duration)}s`}
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>
                {section
                  ? chart.notes.filter(
                      (note) => note.time >= section.start && note.time < section.end,
                    ).length
                  : chart.notes.length}
              </dd>
            </div>
            <div>
              <dt>Speed</dt>
              <dd>{Math.round(speed * 100)}%</dd>
            </div>
            <div>
              <dt>Loop</dt>
              <dd>{loop ? "On" : "Off"}</dd>
            </div>
          </dl>
          <p className="quiet-note">
            Saves are untouched. Use practice to learn the section, then take it into Career or
            Quickplay.
          </p>
        </aside>
      </div>
    </div>
  );
}
