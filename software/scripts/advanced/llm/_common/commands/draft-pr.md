[Sy] Create a WIP pull request for the current branch. Not a GitHub draft — a regular PR with a WIP title prefix so CI runs.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. NEVER derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` — if every author is Sy + known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`), the repo is solo+bots:
   - All authors are Sy + known bots → **solo+bots**. Unless the user explicitly said "open a PR" / "draft a PR" / "create a PR" in this request, announce `"Looks like a solo+bots repo — pushing direct to <default> with a WIP commit message instead of opening a PR. Override with 'draft a PR' if you want one."`, prefix the latest commit message with `WIP: DO NOT MERGE — ` (amend if needed), push to default, and stop.
   - Otherwise → proceed with WIP PR flow.
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
   - Title format: `WIP: DO NOT MERGE — [<repo>] <concise description of changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). The WIP prefix stays outermost so the stop signal reads first.
   - **Template found (Step 5a) → the body IS that template, filled in.** Read it and reproduce its structure exactly: every heading, in its original order, with its original wording and level. Fill each section with what is true *right now* — this is a WIP, so unfinished sections say so (`TODO — still wiring up X`) instead of being deleted or fabricated. Replace `<!-- ... -->` placeholder comments with the answer they ask for. Keep checklists and tick only what is genuinely done; on a WIP most boxes correctly stay unticked.
   - **No template → default body:** a `## Summary` section with bullet points and a `## Test plan` section.
   - Prefer `--body-file <tmp>` over `--body "..."` whenever the body is long or contains backticks, quotes, or `$` — it avoids a shell-quoting mangle of the template.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR (regular, NOT draft): `gh pr create --title "WIP: DO NOT MERGE — [<repo>] ..." --body "..."`
9. Return the PR URL.
10. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- **A repo PR template outranks the default body.** `gh pr create --body` / `--body-file` **overrides** the template GitHub would have pre-filled, so passing a body without reading the template first silently discards it — that is the whole reason Step 5a exists. When a template is present: keep every heading, in order, with its original wording and level; never drop a section, never invent one that isn't there. On a WIP, an unfinished section is marked `TODO — <what's left>`, never deleted.
- **Never tick a checklist box for something you did not do.** Template checklists are assertions a human reviewer trusts ("tests added", "docs updated", "breaking change noted"). Tick only what the diff actually shows. This is a WIP by definition, so most boxes should stay unticked — that is honest signal, not an omission to paper over.
- Always create as a **regular PR** (never `--draft`) so CI runs immediately.
- Always use the title prefix `WIP: DO NOT MERGE —` followed by `[<repo>] ` and a concise description.
- **Never enable automerge on a WIP PR** — automerge is opt-in only, never set `--auto` unless the user explicitly requests it. The `DO NOT MERGE` title is the human signal; `--auto` would defeat it.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
