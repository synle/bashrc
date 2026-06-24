[Sy] Create a pull request for the current branch.

## Steps

1. **Resolve the repo** per global rule 51: `git remote get-url origin` → authoritative `owner/repo`. Do not derive from folder name.
2. **Solo+bots check (global rule 60).** Run `git log --format='%ae' -200 | sort -u` and inspect the unique author list:
   - All authors are Sy (`git config --get user.email` + historical Sy emails) and/or known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`) → **solo+bots**.
   - Otherwise → **multi-human**, proceed with PR flow.
   - **On solo+bots, unless the user explicitly said "open a PR" / "create a PR" / "draft a PR" in this request:** announce `"Looks like a solo+bots repo (<N> author(s): <emails>) — pushing direct to <default> instead of opening a PR. Override with 'open a PR' if you want one."`, then push to default (`git push origin <default>`) and stop. Skip every step below; auto-release per rule 49 will fire on the next cycle.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. Determine the base branch (usually `master` or `main`).
5. Run `git diff <base>...HEAD` to understand all changes included in the PR.
6. Generate a PR title and body based on the changes:
   - Title: concise description of the changes.
   - Body should include a `## Summary` section with bullet points and a `## Test plan` section.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR: `gh pr create --title "..." --body "..."`
9. Return the PR URL.
10. **Classify diff against rule 59 automerge categories** (trivial / tests-only / dependency-only / docs-only). If it fits one of the four, ask the user once: `"This PR looks like <category>. Want me to enable automerge (gh pr merge --squash --auto)? (yes/no, default no)"`. On explicit "yes": run `gh pr merge <number> --squash --auto`. On anything else (or outside the four categories): do not pass `--auto`, do not ask.
11. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- **Squash merge only.** Every PR merges via `gh pr merge --squash`. Never use `--merge` (regular merge commit) or `--rebase`. One PR = one commit on the default branch.
- **Automerge is opt-in only — see global rule 59.** Never pass `--auto` by default. Surface the prompt proactively only for trivial / tests-only / dependency-only / docs-only diffs (Step 10). Outside those four: do not ask, do not enable.
- **Skip PR creation entirely on solo+bots repos** per global rule 60 — push direct to default unless the user explicitly asks for a PR.
- If `gh` reports the repo's allowed merge methods don't include squash, stop and surface the misconfiguration — do not fall back to a merge commit.
- **Post-merge release is automatic** (global rule 49). When the babysit flow runs against this PR (or the user runs `/sy-babysit-pr` later), it will invoke `/sy-release` immediately after the PR transitions to `MERGED`. Repos without a release workflow no-op cleanly. No separate user action needed.
