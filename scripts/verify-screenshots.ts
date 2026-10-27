import { existsSync, readdirSync, readFileSync } from "node:fs";

const readme = readFileSync("README.md", "utf8");
const referenced = new Set(
  [...readme.matchAll(/docs\/screenshots\/([A-Za-z0-9_.-]+)/g)].map((match) => match[1] ?? ""),
);
const present = new Set(
  existsSync("docs/screenshots")
    ? readdirSync("docs/screenshots").filter((file) => file.endsWith(".png"))
    : [],
);

const missing = [...referenced].filter((file) => !present.has(file));
const unreferenced = [...present].filter((file) => !referenced.has(file));

if (missing.length > 0 || unreferenced.length > 0) {
  if (missing.length > 0) console.error(`Missing README screenshots: ${missing.join(", ")}`);
  if (unreferenced.length > 0) {
    console.error(`Unreferenced committed screenshots (AGENTS.md): ${unreferenced.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Screenshot manifest OK: ${present.size} files referenced by README.md.`);
}
