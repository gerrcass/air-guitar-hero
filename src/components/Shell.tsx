import type { JSX, ReactNode } from "react";
import { useGamepadMenu } from "../input/useGamepadMenu";
import type { Route } from "../state/router";
import { careerStarTotal } from "../state/save";
import { useSave } from "../state/store";

const NAV = [
  { label: "Career", route: "career" },
  { label: "Quickplay", route: "quickplay" },
  { label: "Practice", route: "practice" },
  { label: "Face-off", route: "faceoff" },
  { label: "Tutorial", route: "tutorial" },
  { label: "Settings", route: "settings" },
  { label: "Extras", route: "extras" },
] as const;

interface ShellProps {
  readonly route: Route;
  readonly immersive: boolean;
  readonly children: ReactNode;
}

export function Shell({ route, immersive, children }: ShellProps): JSX.Element {
  const save = useSave();
  useGamepadMenu(true);
  const stars = careerStarTotal(save);

  return (
    <div
      className={`app-shell${immersive ? " app-shell--immersive" : ""}${
        save.settings.reduceMotion ? " app-shell--reduced" : ""
      }`}
    >
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to content
      </button>
      {!immersive && (
        <header className="site-header">
          <div className="site-header__inner">
            <a className="wordmark" href="#/">
              <svg viewBox="0 0 40 40" aria-hidden="true" className="wordmark__pick">
                <defs>
                  <linearGradient id="wordmark-pick" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ff2d95" />
                    <stop offset="1" stopColor="#4de1ff" />
                  </linearGradient>
                </defs>
                <path
                  d="M20 4c6 0 11 5 11 11 0 8-6 14-11 20-5-6-11-12-11-20C9 9 14 4 20 4z"
                  fill="url(#wordmark-pick)"
                />
                <path
                  d="M20 11l1.9 4.1 4.5.6-3.3 3.1.9 4.5-4-2.2-4 2.2.9-4.5-3.3-3.1 4.5-.6z"
                  fill="#050609"
                />
              </svg>
              <span>
                <span className="wordmark__air">Air</span>
                <span className="wordmark__hero">Guitar Hero</span>
              </span>
            </a>

            <nav className="primary-nav" aria-label="Main modes">
              {NAV.map((item) => (
                <a
                  key={item.route}
                  href={`#/${item.route}`}
                  className="primary-nav__link"
                  aria-current={route.name === item.route ? "page" : undefined}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="header-stats">
              <span className="sr-only">Career stars: </span>
              <span className="header-stats__stars" aria-hidden="true">
                ★
              </span>
              <span>
                <strong>{stars}</strong>
                <span className="header-stats__label"> stars</span>
              </span>
            </div>
          </div>
          <p className="mobile-note" role="note">
            Gameplay needs a keyboard or gamepad. Menus work on touch.
          </p>
        </header>
      )}

      <main id="main" className="site-main" tabIndex={-1}>
        {children}
      </main>

      {!immersive && (
        <footer className="site-footer">
          <div className="site-footer__inner">
            <p className="site-footer__tagline">
              Original music. Original art. Built for the browser.
            </p>
            <nav className="site-footer__links" aria-label="Project links">
              <a href="#/extras">Controls &amp; credits</a>
              <a
                href="https://github.com/gerrcass/air-guitar-hero"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a
                href="https://github.com/gerrcass/air-guitar-hero/blob/main/docs/engineering/ARCHITECTURE.md"
                target="_blank"
                rel="noreferrer"
              >
                Architecture
              </a>
            </nav>
            <p className="site-footer__build">
              v{__APP_VERSION__} · {__BUILD_SHA__}
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
