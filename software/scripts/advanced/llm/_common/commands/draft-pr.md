[Sy] Create a WIP pull request for the current branch. Not a GitHub draft — a regular PR with a WIP title prefix so CI runs.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. NEVER derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` — if every author is Sy + known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`), the repo is solo+bots:
   - All authors are Sy + known bots → **solo+bots**. Unless the user explicitly said "open a PR" / "draft a PR" / "create a PR" in this request, announce `"Looks like a solo+bots repo — pushing direct to <default> with a WIP commit message instead of opening a PR. Override with 'draft a PR' if you want one."`, prefix the latest commit message with `WIP: DO NOT MERGE — ` (amend if needed), push to default, and stop.
   - Otherwise → proceed with WIP PR flow.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. Determine the base branch (usually `master` or `main`).
5. Run `git diff <base>...HEAD` to understand all changes included in the PR.
6. Generate a PR title and body based on the changes:
   - Title format: `WIP: DO NOT MERGE — [<repo>] <concise description of changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). The WIP prefix stays outermost so the stop signal reads first.
   - Body should include a `## Summary` section with bullet points and a `## Test plan` section.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR (regular, NOT draft): `gh pr create --title "WIP: DO NOT MERGE — [<repo>] ..." --body "..."`
9. Return the PR URL.
10. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- Always create as a **regular PR** (never `--draft`) so CI runs immediately.
- Always use the title prefix `WIP: DO NOT MERGE —` followed by `[<repo>] ` and a concise description.
- **Never enable automerge on a WIP PR** — automerge is opt-in only, never set `--auto` unless the user explicitly requests it. The `DO NOT MERGE` title is the human signal; `--auto` would defeat it.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
