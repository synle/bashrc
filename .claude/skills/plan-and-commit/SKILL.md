---
name: plan-and-commit
description: Write a plan, execute it, commit the result, and leave behind plan-YYYY-MM-DD-<slug>.md plus plan-YYYY-MM-DD-<slug>.diff in ~/sy_llm_ai/plans/<repo>/. Use for any multi-file or multi-step change where the reasoning is worth recording alongside the code.
---

Turn a request into a written plan, execute that plan, commit the result, and leave two artifacts behind: the plan and the diff it produced.

The task is: `$ARGUMENTS` — if that placeholder arrives unexpanded or empty, use the task described in the request instead.

Use this when the change spans multiple files or steps and the reasoning is worth keeping. For a one-line fix, skip it and just make the edit.

## Artifacts

| File                                                   | Contents                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `~/sy_llm_ai/plans/<repo>/plan-YYYY-MM-DD-<slug>.md`   | The plan — TLDR, goal, decisions, per-file change table, risks, validation, wrap-up |
| `~/sy_llm_ai/plans/<repo>/plan-YYYY-MM-DD-<slug>.diff` | Unified diff of exactly what the commit(s) changed                                  |

`<repo>` is the repo name from `git remote get-url origin`, never the folder name (see Repo Identification). `YYYY-MM-DD` is the creation date (`date +%Y-%m-%d`), fixed at first write and never re-dated on later edits, so `ls ~/sy_llm_ai/plans/<repo>/` reads as a date-ordered inventory. `<slug>` is kebab-case, derived from the task's feature name (`plan-2026-08-12-llm-instructions.md`, `plan-2026-08-12-fix-auth-retry.md`); reuse the `<slug>` alone — not the date — as the branch `<group-slug>` if the work spans several branches. An RFC written for the same work uses the parallel name `rfc-YYYY-MM-DD-<slug>.md`, so plan and RFC sort together by date and share the feature slug.

**Artifacts live outside every repo** — `mkdir -p "$HOME/sy_llm_ai/plans/<repo>"` before the first write. Nothing lands in the working tree, so there is no `.gitignore` entry to maintain, nothing to accidentally commit, and no untracked noise in `git status`. Full rationale in the rules file (see Plans & Wrap-Ups). If the user explicitly wants a plan tracked in the repo, copy it in and `git add` it in a clearly-labeled follow-up commit — never silently.

## Steps

### 1. Establish a clean starting point

- Resolve `<owner>/<repo>` via `git remote get-url origin` — never from the folder name (see Repo Identification).
- Record the base SHA: `git rev-parse HEAD`. Every diff below is measured from here.
- `git status --porcelain` — if the tree is dirty, list the pre-existing changes and ask whether to (a) stash them, (b) proceed and leave them out of the commit, or (c) abort. **Never fold someone else's uncommitted work into your commit.** Note every pre-existing dirty path; those paths are excluded from staging in Step 5.
- Read the repo's rules file (`AGENTS.md` / `CLAUDE.md`) and its map (`DEV.md`, `ARCHITECTURE.md`) before planning. Rules without the map produce locally-correct, architecturally-wrong changes.

### 2. Write `plan-YYYY-MM-DD-<slug>.md`

Sections, in order:

- **TLDR** — two or three plain sentences at the very top: what changes and why, understandable with zero context. No file paths, no jargon.
- **Goal** — what the user asked, restated concretely. Number each ask if there were several.
- **Decisions** — every judgment call you made that the user didn't specify: naming, approach, alternatives rejected and why. This is the section that earns the file's existence.
- **Changes** — what happens, grouped by ask, with enough detail to review without reading the diff.
- **Files touched** — a table of path → one-line change.
- **Risks** — what could break, what's irreversible, what's invisible until the next deploy or run.
- **Validation** — the exact commands that prove it worked.

`## Wrap-Up` is appended later, in Step 6 — don't write it up front.

Apply Scope Discipline (YAGNI) here, not after: state rungs 1-6 out loud before adding any new file, class, dependency, or abstraction.

### 3. Confirm before executing

Show the user the plan's Goal + Changes and ask: `"Execute this plan? (yes / edit / no)"`.

- **yes** → proceed to Step 4.
- **edit** → take their corrections, rewrite `plan-YYYY-MM-DD-<slug>.md`, ask again.
- **no** → stop. The plan file stays on disk; nothing was changed.

Skip this confirmation only when the user already pre-approved (e.g. "just do it", autopilot mode).

### 4. Execute

Work through the plan. If reality diverges — a file isn't where you expected, an approach doesn't work, a new constraint appears — **update `plan-YYYY-MM-DD-<slug>.md` to match what you actually did**. A plan that describes a different change than the diff is worse than no plan.

### 5. Validate, then commit

1. Run the repo's own validation before committing. Look for it in this order: the rules file's documented command (e.g. `make validate`), then `Makefile` targets, then `package.json` scripts, then the language default (`cargo test`, `go test ./...`, `pytest`).
2. **Validation failure blocks the commit.** Fix it. If it can't be fixed, report the failure and stop — do not commit red. Only commit a failing tree on an explicit user override, and say so in the commit body.
3. Stage **only the paths in the plan's Files-touched table**, minus anything that was already dirty in Step 1. Never `git add -A` / `git add .` — that's how unrelated work gets swept into a commit.
4. Run the Commit-author check (see Source Control & PRs) before committing.
5. Commit once, with a real message: subject line describing the change, body summarizing the plan's Goal.

### 6. Append the wrap-up and emit `plan-YYYY-MM-DD-<slug>.diff`

Write `## Wrap-Up` at the bottom of `plan-YYYY-MM-DD-<slug>.md` (see Plans & Wrap-Ups): every file touched (path → one-line what changed), what was added / removed / renamed, every deviation from the plan and why, the validation command and its result, plus follow-ups or known gaps. A reader who never saw the diff should be able to review the change from this section alone.

Then emit the diff — `$PLANS` is `$HOME/sy_llm_ai/plans/<repo>`:

```bash
git diff <base-sha>..HEAD > "$PLANS/plan-YYYY-MM-DD-<slug>.diff"
```

Use the base SHA from Step 1, so the diff covers the whole task even if it took more than one commit. No excludes needed — the artifacts live outside the repo.

### 7. Report

State: the commit SHA(s), the two artifact paths, the validation command and its result, and anything from the plan you deliberately skipped. Then stop.

## Rules

- **Stop at the commit.** Never `git push`, never `gh pr create`, never merge. Landing the work is a separate, explicit decision — hand off to `/sy-create-pr` if the user wants a PR.
- **The plan is written before the code, not after.** A plan reverse-engineered from a finished diff is a changelog, not a plan, and skips the review moment in Step 3 that makes this skill worth running.
- **Plan and diff must agree.** If you deviated during execution, the plan gets updated and the Wrap-Up says so. Verify before reporting.
- **One task, one slug.** Don't overwrite an existing `~/sy_llm_ai/plans/<repo>/plan-YYYY-MM-DD-<slug>.*` pair from earlier work — pick a distinct slug or ask.
- **Artifacts are prose, not code.** Persona overlays (e.g. Caveman Speak) never apply to `plan-YYYY-MM-DD-<slug>.md` or to commit messages — both are read by humans other than the requester.
- **Never commit secrets** surfaced while planning. If the diff would contain a credential, stop and report instead.
