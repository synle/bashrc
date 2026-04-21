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
