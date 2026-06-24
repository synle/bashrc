[Sy] Create a WIP pull request for the current branch. Not a GitHub draft — a regular PR with a WIP title prefix so CI runs.

## Steps

1. **Resolve the repo** per global rule 51: `git remote get-url origin` → authoritative `owner/repo`.
2. **Solo+bots check (global rule 60).** Run `git log --format='%ae' -200 | sort -u`:
   - All authors are Sy + known bots → **solo+bots**. Unless the user explicitly said "open a PR" / "draft a PR" / "create a PR" in this request, announce `"Looks like a solo+bots repo — pushing direct to <default> with a WIP commit message instead of opening a PR. Override with 'draft a PR' if you want one."`, prefix the latest commit message with `WIP: DO NOT MERGE — ` (amend if needed), push to default, and stop.
   - Otherwise → proceed with WIP PR flow.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. Determine the base branch (usually `master` or `main`).
5. Run `git diff <base>...HEAD` to understand all changes included in the PR.
6. Generate a PR title and body based on the changes:
   - Title format: `WIP: DO NOT MERGE — <concise description of changes>`
   - Body should include a `## Summary` section with bullet points and a `## Test plan` section.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR (regular, NOT draft): `gh pr create --title "WIP: DO NOT MERGE — ..." --body "..."`
9. Return the PR URL.
10. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- Always create as a **regular PR** (never `--draft`) so CI runs immediately.
- Always use the title prefix `WIP: DO NOT MERGE —` followed by a concise description.
- **Never enable automerge on a WIP PR** (global rule 59). The `DO NOT MERGE` title is the human signal; `--auto` would defeat it.
- **Skip PR creation entirely on solo+bots repos** per global rule 60 — push direct to default unless the user explicitly asks for a PR.
