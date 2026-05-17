[Sy] Create a WIP pull request for the current branch. Not a GitHub draft — a regular PR with a WIP title prefix so CI runs.

## Steps

1. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
2. Determine the base branch (usually `master` or `main`).
3. Run `git diff <base>...HEAD` to understand all changes included in the PR.
4. Generate a PR title and body based on the changes:
   - Title format: `WIP: DO NOT MERGE — <concise description of changes>`
   - Body should include a `## Summary` section with bullet points and a `## Test plan` section.
5. Push the branch if needed: `git push -u origin <branch>`
6. Create the PR (regular, NOT draft): `gh pr create --title "WIP: DO NOT MERGE — ..." --body "..."`
7. Return the PR URL.
8. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- Always create as a **regular PR** (never `--draft`) so CI runs immediately.
- Always use the title prefix `WIP: DO NOT MERGE —` followed by a concise description.
