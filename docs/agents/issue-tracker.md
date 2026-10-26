# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>`. Use a heredoc or a file for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+).
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Blocking edges

Use GitHub's native issue dependencies. Add an edge with:

```sh
gh api --method POST repos/{owner}/{repo}/issues/<child>/dependencies/blocked_by \
  -F issue_id=<blocker-db-id>
```

`<blocker-db-id>` is the numeric **database id** of the blocker
(`gh api repos/{owner}/{repo}/issues/<n> --jq .id`), not its `#number`. Where native
dependencies are unavailable, put a `Blocked by: #<n>, #<n>` line at the top of the child
body and keep it current.

A ticket is unblocked when every blocker is closed. Triage for agent work uses
`ready-for-agent`.

## Evidence uploads

`gh pr comment <n> --body-file <file> --attach <path>` uploads screenshots or short video
and rewrites references in the body. Attach the gameplay screenshot and any before/after
evidence; do not rely on repository-relative image links in PR comments.
