[Sy] Create a pull request for the current branch.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. Do not derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` and inspect the unique author list:
   - All authors are Sy (`git config --get user.email` + historical Sy emails) and/or known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`) → **solo+bots**.
   - Otherwise → **multi-human**, proceed with PR flow.
   - **On solo+bots, unless the user explicitly said "open a PR" / "create a PR" / "draft a PR" in this request:** announce `"Looks like a solo+bots repo (<N> author(s): <emails>) — pushing direct to <default> instead of opening a PR. Override with 'open a PR' if you want one."`, then push to default (`git push origin <default>`) and stop. Skip every step below; auto-release after push-to-default will fire on the next cycle.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. Determine the base branch (usually `master` or `main`).
5. Run `git diff <base>...HEAD` to understand all changes included in the PR.

5a. **Look for the repo's PR template — it dictates the body format when one exists.**

    ```bash
    git ls-files | grep -i pull_request_template
    ```

    Plain substring match, so it is case-insensitive and finds every layout GitHub honors. Resolve in GitHub's own precedence order, first hit wins:

    1. `.github/PULL_REQUEST_TEMPLATE.md` (or lowercase)
    2. `PULL_REQUEST_TEMPLATE.md` at the repo root
    3. `docs/PULL_REQUEST_TEMPLATE.md`
    4. `.github/PULL_REQUEST_TEMPLATE/*.md` — the **multi-template** directory form

    On the directory form, pick the template whose name best matches this change (`bugfix.md`, `feature.md`, …) and say which you picked; ask the user when two are equally plausible. No match from any path → no template, use the default body in Step 6.

6. Generate a PR title and body based on the changes:
   - Title: `[<repo>] <concise description of the changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). Repo comes from Step 1's resolved `owner/repo`, keeping only the part after the `/`.
   - **Template found (Step 5a) → the body IS that template, filled in.** Read it and reproduce its structure exactly: every heading, in its original order, with its original wording and level. Fill each section with real content derived from the diff. Replace `<!-- ... -->` placeholder comments with the answer they ask for rather than leaving them in. Keep checklists and tick only what is genuinely true.
   - **No template → default body:** a `## Summary` section with bullet points and a `## Test plan` section.
   - Prefer `--body-file <tmp>` over `--body "..."` whenever the body is long or contains backticks, quotes, or `$` — it avoids a shell-quoting mangle of the template.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR: `gh pr create --title "[<repo>] ..." --body "..."`
9. Return the PR URL.
10. **Classify diff against automerge categories** (trivial / tests-only / dependency-only / docs-only). If it fits one of the four, ask the user once: `"This PR looks like <category>. Want me to enable automerge (gh pr merge --squash --auto)? (yes/no, default no)"`. On explicit "yes": run `gh pr merge <number> --squash --auto`. On anything else (or outside the four categories): do not pass `--auto`, do not ask.
11. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- **A repo PR template outranks the default body.** `gh pr create --body` / `--body-file` **overrides** the template GitHub would have pre-filled, so passing a body without reading the template first silently discards it — that is the whole reason Step 5a exists. When a template is present: keep every heading, in order, with its original wording and level; never drop a section, never invent one that isn't there. A section that genuinely doesn't apply gets `N/A` plus a half-line why, not deletion.
- **Never tick a checklist box for something you did not do.** Template checklists are assertions a human reviewer trusts ("tests added", "docs updated", "breaking change noted"). Tick only what the diff actually shows; leave the rest unticked and call them out in the summary. A blanket-checked list is worse than an empty one.
- **Squash merge only.** Every PR merges via `gh pr merge --squash`. Never use `--merge` (regular merge commit) or `--rebase`. One PR = one commit on the default branch.
- **Automerge is opt-in only.** Never pass `--auto` by default. Surface the prompt proactively only for trivial / tests-only / dependency-only / docs-only diffs (Step 10). Outside those four: do not ask, do not enable.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
- If `gh` reports the repo's allowed merge methods don't include squash, stop and surface the misconfiguration — do not fall back to a merge commit.
- **Post-merge release is automatic.** When the babysit flow runs against this PR (or the user runs `/sy-babysit-pr` later), it will invoke `/sy-release` immediately after the PR transitions to `MERGED`. Repos without a release workflow no-op cleanly. No separate user action needed.
