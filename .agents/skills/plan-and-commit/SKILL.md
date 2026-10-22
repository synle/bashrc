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

### 1. Record the starting state

- Resolve `<owner>/<repo>` via `git remote get-url origin` — never from the folder name (see Repo Identification).
- Record the base SHA: `git rev-parse HEAD`. Every diff below is measured from here.
- Inspect `git status --porcelain`, the worktree diff, and the staged diff; record pre-existing work without changing it. Follow Concurrent work and Commit/push authority: continue around unrelated dirty files without asking, and isolate task hunks even in already-dirty files. Do not stash or exclude an entire path merely because it was dirty.
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

### 3. Execute clear requests without repeated approval

Show the plan's Goal + Changes, then proceed to Step 4 when the request clearly authorizes implementation. A written plan does not create a new approval gate, and unrelated dirty files do not require confirmation.

Ask only when the plan introduces an unapproved scope or decision under Task Contract, or reaches an ownership, inseparable-overlap, secret, or destructive-action boundary. For a planning-only request, deliver the plan and stop; do not treat it as implementation or commit authority.

### 4. Execute

Work through the plan. If reality diverges — a file isn't where you expected, an approach doesn't work, a new constraint appears — **update `<repo>-<feature>.md` to match what you actually did**. A plan that describes a different change than the diff is worse than no plan.

### 5. Validate, then commit

1. Run the repo's own validation before committing. Look for it in this order: the rules file's documented command (e.g. `make validate`), then `Makefile` targets, then `package.json` scripts, then the language default (`cargo test`, `go test ./...`, `pytest`).
2. **Validation failure blocks the commit.** Fix it. If it can't be fixed, report the failure and stop — do not commit red. Only commit a failing tree on an explicit user override, and say so in the commit body.
3. Recheck the live worktree and index, then stage **only task hunks within the plan's Files-touched table**. Already-dirty files are allowed when task hunks can be separated. Follow Commit/push authority to preserve unrelated staged changes and keep them out of the commit. Never `git add -A` / `git add .`.
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
- blanket-stage files; stage only task hunks in the paths the plan named
- rebase, force-push, reset, or drop a stash to get a clean starting point — preserve existing work and continue around it
- commit while validation is red, or write a Wrap-Up claiming a validation you did not run
- overwrite an existing plan or diff artifact from earlier work
- create any subfolder under `~/_extra/ai_llm/plans/`, or write a generated script or data file to a name that does not start with its plan's stem

Stop and ask when changes overlap inseparably, ownership is unclear, an action risks data loss, or the plan requires unapproved scope. Unrelated uncommitted changes alone are not a reason to stop.

## Verification

Before declaring success, confirm and report:

- the commit SHA(s), that the commit contains only task hunks, and that unrelated worktree and index changes remain intact; report remaining dirty work without treating it as failure
- both artifact paths, with the diff regenerated from the actual commit range rather than hand-assembled
- the validation command and its result, quoted, not paraphrased
- every deviation from the plan, reflected in both the plan body and the Wrap-Up
- anything from the plan deliberately skipped, and why
