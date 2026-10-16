---
name: plan-and-commit
description: Write a plan, execute it, commit the result, and leave behind <repo>-<feature>.md plus <repo>-<feature>.diff in the flat ~/_extra/ai_llm/plans/ folder. Use for any multi-file or multi-step change where the reasoning is worth recording alongside the code.
---

## Purpose

Turn a request into a written plan, execute that plan, commit the result, and leave two artifacts behind: the plan and the diff it produced.

The task is: `$ARGUMENTS` — if that placeholder arrives unexpanded or empty, use the task described in the request instead.

Use for multi-step work worth recording; skip trivial edits.

## Artifacts

| File                                          | Contents                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `~/_extra/ai_llm/plans/<repo>-<feature>.md`   | The plan — TLDR, goal, decisions, per-file change table, risks, validation, wrap-up |
| `~/_extra/ai_llm/plans/<repo>-<feature>.diff` | Unified diff of exactly what the commit(s) changed                                  |

Follow Plans & Wrap-Ups for remote-derived repo name, snake_case feature, flat placement, `_v<N>` rewrites, and stem-linked sidecars. Use kebab-case only when deriving a branch group slug.

Verify the shared plans folder before writing. A user-requested tracked copy belongs in a clearly labelled follow-up commit, never an implicit move into the checkout.

## Steps

### 1. Establish a clean starting point

- Resolve `<owner>/<repo>` via `git remote get-url origin` — never from the folder name (see Repo Identification).
- Record the base SHA: `git rev-parse HEAD`. Every diff below is measured from here.
- `git status --porcelain` — if the tree is dirty, list the pre-existing changes and ask whether to (a) stash them, (b) proceed and leave them out of the commit, or (c) abort. **Never fold someone else's uncommitted work into your commit.** Note every pre-existing dirty path; those paths are excluded from staging in Step 5.
- Read the repo's rules file (`AGENTS.md` / `CLAUDE.md`) and its map (`DEV.md`, `ARCHITECTURE.md`) before planning. Rules without the map produce locally-correct, architecturally-wrong changes.

### 2. Write `<repo>-<feature>.md`

Sections, in order:

- **TLDR** — two or three plain sentences at the very top: what changes and why, understandable with zero context. No file paths, no jargon.
- **Impact** — benefit, rough effort, and cost of inaction, immediately after TLDR.
- **Goal** — what the user asked, restated concretely. Number each ask if there were several.
- **Decisions** — every judgment call you made that the user didn't specify: naming, approach, alternatives rejected and why. This is the section that earns the file's existence.
- **Changes** — what happens, grouped by ask, with enough detail to review without reading the diff.
- **Files touched** — a table of path → one-line change.
- **Risks** — what could break, what's irreversible, what's invisible until the next deploy or run.
- **Validation** — the exact commands that prove it worked.

`## Wrap-Up` is appended later, in Step 6 — don't write it up front.

Apply Scope Discipline before adding a new file, class, dependency, or abstraction; explain why earlier rungs fail when reaching new implementation.

### 3. Confirm before executing

Show the user the plan's Goal + Changes and ask: `"Execute this plan? (yes / edit / no)"`.

- **yes** → proceed to Step 4.
- **edit** → take their corrections, rewrite `<repo>-<feature>.md`, ask again.
- **no** → stop. The plan file stays on disk; nothing was changed.

Skip this confirmation only when the user already pre-approved (e.g. "just do it", autopilot mode).

### 4. Execute

Work through the plan. If reality diverges — a file isn't where you expected, an approach doesn't work, a new constraint appears — **update `<repo>-<feature>.md` to match what you actually did**. A plan that describes a different change than the diff is worse than no plan.

### 5. Validate, then commit

1. Run the repo's own validation before committing. Look for it in this order: the rules file's documented command (e.g. `make validate`), then `Makefile` targets, then `package.json` scripts, then the language default (`cargo test`, `go test ./...`, `pytest`).
2. **Validation failure blocks the commit.** Fix it. If it can't be fixed, report the failure and stop — do not commit red. Only commit a failing tree on an explicit user override, and say so in the commit body.
3. Stage **only the paths in the plan's Files-touched table**, minus anything that was already dirty in Step 1. Never `git add -A` / `git add .` — that's how unrelated work gets swept into a commit.
4. Run the Commit-author check (see Source Control & PRs) before committing.
5. Commit once, with a real message: subject line describing the change, body summarizing the plan's Goal.

### 6. Append the wrap-up and emit `<repo>-<feature>.diff`

Write `## Wrap-Up` at the bottom of `<repo>-<feature>.md` (see Plans & Wrap-Ups): every file touched (path → one-line what changed), what was added / removed / renamed, every deviation from the plan and why, the validation command and its result, plus follow-ups or known gaps. A reader who never saw the diff should be able to review the change from this section alone.

Then emit the diff — `$PLANS` is `~/_extra/ai_llm/plans`:

```bash
git diff <base-sha>..HEAD > "$PLANS/<repo>-<feature>.diff"
```

Use the base SHA from Step 1, so the diff covers the whole task even if it took more than one commit. No excludes needed — the artifacts live outside the repo.

### 7. Report

State: the commit SHA(s), the two artifact paths, the validation command and its result, and anything from the plan you deliberately skipped. Then stop.

## Rules

- **Stop at the commit.** Never `git push`, never `gh pr create`, never merge. Landing the work is a separate, explicit decision — when the user wants a PR, run whatever pull-request workflow the environment provides as its own step.
- **The plan is written before the code, not after.** A plan reverse-engineered from a finished diff is a changelog, not a plan, and skips the review moment in Step 3 that makes this skill worth running.
- **Plan and diff must agree.** If you deviated during execution, the plan gets updated and the Wrap-Up says so. Verify before reporting.
- **One task, one feature name.** Don't overwrite an existing `~/_extra/ai_llm/plans/<repo>-<feature>.*` set from earlier work — pick a distinct feature name, or bump to `_v<N>` and keep both, or ask.
- **Artifacts are prose, not code.** Persona overlays (e.g. Caveman Speak) never apply to `<repo>-<feature>.md` or to commit messages — both are read by humans other than the requester.
- **Never commit secrets** surfaced while planning. If the diff would contain a credential, stop and report instead.

## Safety

Never:

- push, open a pull request, or merge — this skill ends at the commit
- `git add -A` over files you did not touch; stage only the paths the plan named
- rebase, force-push, reset, or drop a stash to get a clean starting point — Step 1 stops and asks instead
- commit while validation is red, or write a Wrap-Up claiming a validation you did not run
- overwrite an existing plan or diff artifact from earlier work
- create any subfolder under `~/_extra/ai_llm/plans/`, or write a generated script or data file to a name that does not start with its plan's stem

If the working tree holds unrelated uncommitted changes, or the plan turns out to need a scope the user did not approve in Step 3, stop and ask.

## Verification

Before declaring success, confirm and report:

- the commit SHA(s), and that `git status` is clean afterwards
- both artifact paths, with the diff regenerated from the actual commit range rather than hand-assembled
- the validation command and its result, quoted, not paraphrased
- every deviation from the plan, reflected in both the plan body and the Wrap-Up
- anything from the plan deliberately skipped, and why
