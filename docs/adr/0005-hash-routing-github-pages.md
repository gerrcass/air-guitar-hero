# Hash routing on GitHub Pages

The app uses hash-based routes (`#/career`, `#/play/...`) rather than history routes.
GitHub Pages has no rewrite rule, so a deep link such as `/career` would 404 on refresh;
hash routes survive static hosting unchanged and keep the Vite base-path configuration
trivial. The cost is uglier URLs and no server-side rendering, neither of which matters
for a game.
