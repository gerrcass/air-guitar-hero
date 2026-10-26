# Domain Docs

How engineering agents consume this repo's domain documentation.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root — the canonical game vocabulary.
- **`docs/adr/`** — read decisions that touch the area you are about to work in.
- **`docs/design/DESIGN-GRILL.md`** — the settled scope and trade-offs.
- **`docs/engineering/ARCHITECTURE.md`** — module boundaries, data flow, and seams.

If a file does not exist yet, proceed silently. Create domain docs only when a term or
decision is actually resolved.

## Use the glossary's vocabulary

Name concepts exactly as `GLOSSARY.md` defines them in issues, tests, commits, and code.
If a concept is missing, either you are inventing language the project does not use
(reconsider) or there is a real gap (record it for `/domain-modeling`).

## Flag ADR conflicts

If your work contradicts an existing ADR, surface it explicitly instead of silently
overriding it:

> _Contradicts ADR-0004 (canvas highway), but worth reopening because…_
