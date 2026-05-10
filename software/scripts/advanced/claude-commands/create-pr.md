Create a pull request for the current branch.

## Steps

1. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
2. Determine the base branch (usually `master` or `main`).
3. Run `git diff <base>...HEAD` to understand all changes included in the PR.
4. Generate a PR title and body based on the changes:
   - Title: concise description of the changes.
   - Body should include a `## Summary` section with bullet points and a `## Test plan` section.
5. Push the branch if needed: `git push -u origin <branch>`
6. Create the PR: `gh pr create --title "..." --body "..."`
7. Return the PR URL.
8. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- **Squash merge only.** Every PR is merged with `gh pr merge --squash` (or `gh pr merge --squash --auto` for automerge). Never use `--merge` (regular merge commit) or `--rebase`. One PR = one commit on the default branch.
- **If automerge is requested**, enable it with `--squash --auto`. Do not enable automerge in any other mode.
- If `gh` reports the repo's allowed merge methods don't include squash, stop and surface the misconfiguration — do not fall back to a merge commit.
