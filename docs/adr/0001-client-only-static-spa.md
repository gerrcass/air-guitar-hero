# Client-only static SPA

Air Guitar Hero ships as a static bundle on GitHub Pages with no backend. Saves live in a
versioned localStorage document, and all content is bundled. A server would add accounts,
latency, and failure modes without improving the solo/party loop; a static app also makes
"open the link and play" work with zero setup. The cost is that high scores and career
progress are device-local, and online play is impossible without a future backend.
