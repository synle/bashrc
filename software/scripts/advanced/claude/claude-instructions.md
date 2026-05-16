# Engineering Principles

Stack-agnostic rules. Apply across every language, framework, and codebase.

## Source Control & PRs

1. Branch from a fresh default. Pull right before branching. Task-scoped name. Never branch off a feature branch.
2. Squash on merge — one PR, one commit. **Applies to manual merges AND automerge.** Always `gh pr merge --squash` (or `gh pr merge --squash --auto`). Never merge commits, never rebase merges. If a repo's default automerge mode differs, switch to explicit `--squash` or fix the repo setting.
3. Sync with `git merge origin/<default>`. Never rebase or force-push shared branches.
4. Each PR is a standalone, mergeable unit. Bundle tightly-coupled changes (API + schema + models). Never stack PRs.

## Code Hygiene

5. Fix root causes, not symptoms. Three identical defensive blocks → extract or fix the invariant.
6. Keep comments, titles, and docstrings in sync with the code in the same edit.
7. Delete leftovers in the refactor PR — unused imports, mocks, props, dead helpers. Audit the matching test file.
8. Skip no-op wrappers; factor near-duplicates. Passthroughs are noise; N literals differing in a few fields aren't.
9. Imports and declarations at the top. Lazy only for circular deps or cold-start, with a comment.
10. **Add or update inline documentation for every method, function, class, and exported symbol you touch.** Use the language-native style (JSDoc/TSDoc, Python docstrings, Rust `///`, Go `// FuncName ...`, bash `#` above the function, Javadoc, Swift `///`, Ruby YARD, etc.). Each block covers: one-line description, every parameter, return value + type, raised errors, side effects. When you change a signature, behavior, or contract — update the doc in the same edit. Adding undocumented public methods OR leaving a stale doc next to modified code is a code-review block. Trivial self-evident one-liners (`function isEmpty(x) { return !x; }`) can skip; everything else cannot.

## Logging & Errors

11. Parameterized logging only — pass values as arguments, not formatted strings.
12. Catch the narrowest expected exception. Catch-all swallows real bugs.
13. Catch by type or status code, never by error-message string.
14. Silent catch-and-pass in diagnostic, rollback, or alert paths is a bug. Log at warning level with the original exception attached.
15. Preserve the original stack trace when re-raising. Don't reconstruct an exception from its message.
16. Don't leak raw exceptions to clients. Generic message externally; raw details server-side only. Identifiers in URLs/paths/workflow keys are PII — log non-identifying discriminators.

## Security

17. Parameterize all queries and commands — even "internal" inputs. Never interpolate user data into a query, shell command, or RPC string.
18. URL-encode interpolated path and query params. Signatures accept arbitrary strings.
19. Sanitize at trust boundaries. HTML via a sanitizer; validate `href` protocols; reject empty / absolute / `..` / leading-dot filenames.

## Defensiveness

20. Fail-closed on missing permissions or feature flags.
21. Allowlist inputs; reject unknowns. Default-branch fallthrough is a leak hazard.
22. Check input shape before reading fields. Reject non-object payloads before field access; don't coerce into empty defaults.
23. Treat empty values (`0`, empty string/collection, `false`) as valid, not absent. Test for absence explicitly; never use truthy gates to mean "is set".
24. Bound numerics on both sides — clamp to `[MIN, MAX]`. One-sided clamps let negatives or overflows through.

## Concurrency & Resources

25. One try/catch per batch iteration — outer-only discards earlier successes.
26. Chunk unbounded list params. Query and packet-size limits will bite.
27. Emit heartbeats from long-running jobs or the scheduler kills and retries.
28. Register teardown for async resources — timers, intervals, abort controllers, handles, sessions, pools.
29. No long synchronous retry chains in request handlers. One attempt; queue the rest.
30. Hoist loop-invariant work — permission lookups, regex compiles, deadline math.

## Tests

31. Tests must fail for the right reason — pick assertions only the correct path can satisfy.
32. For ordering contracts, assert call order, not just that both calls happened.
33. Test the symmetric path when changing one of a pair — create↔update, attach↔detach, lock↔unlock, success↔failure.

## Codebase Onboarding

34. **Read DEV.md and the architecture doc before non-trivial work in a repo.** Two canonical map docs sit alongside CLAUDE.md: `DEV.md` (dev setup + how the system executes) and an architecture doc (`ARCHITECTURE.md` at root OR an "Architecture"/"Key Files" section embedded in `CLAUDE.md`). CLAUDE.md = rules; DEV.md + architecture = map. Applying rules without the map produces locally-correct but architecturally-wrong changes. If a repo is missing either, flag it as a gap.

## Change Execution Workflow

How any "work on a change" request runs. Follow exactly unless overridden in the same message.

TL;DR: worktree-isolated, default-fresh at every gate (pre-work, pre-PR, pre-iteration), fan-out in parallel in the background, tests-first PRs, babysit every PR to green.

35. Always use a git worktree. Each unit of work runs in its own isolated worktree (e.g. spawn sub-agents with `isolation: "worktree"`). Never modify the main checkout during parallel work.
36. **Always sync with latest default branch at three mandatory gates.** Run `git fetch origin && git merge origin/<default>` and resolve conflicts at each — stale base = merge pain, redundant re-implementation, CI failures on already-fixed code:
    - **Gate 1 — Before work starts.** Before spawning any sub-agent: `git checkout <default> && git pull --ff-only`, then cut the branch. Always `--ff-only` — if it fails because local default diverged from origin (typically a stray local commit), STOP and reconcile (`git reset --hard origin/<default>` after confirming no unmerged work, or rebase the stray commit). Never let a merge commit land on the default branch itself.
    - **Gate 2 — Right before opening the PR.** Re-sync the feature branch with `origin/<default>` immediately before `gh pr create`. Load-bearing primarily under the _"skip babysit"_ override; otherwise Gate 3 covers it.
    - **Gate 3 — Before every iteration.** Every review comment, CI fix, rebuild, or follow-up commit starts with `git fetch origin && git merge origin/<default>`. Same rule the babysit loop in rule 41 enforces — applies to manual iterations too.
      Never push past a conflicted state. Never `--strategy=ours` away upstream changes you haven't read.
37. Always parallelize within a single session. Independent changes in one request → one message, multiple sub-agent calls. Do not serialize independent work.
38. Always run them in the background. Sub-agents → `run_in_background: true`.
39. Phased work: parallelize within a phase; serialize between phases. Fan out all Phase 1 in parallel/background, wait for completion, fan out Phase 2. Never serialize within a phase.
40. PR order is fixed: tests first, then coverage gate, then push. Every PR starts by adding tests. Confirm the changed-code coverage gate passes — **≥ 80% line coverage; branch threshold 75% for BE/agent repos, 90% for FE repos** — before pushing. No PR without tests.
41. Babysit every PR all the way to green CI. Use `/babysit-pr` / `/babysit-prs`. "PR opened" is not "done." Every babysit cycle starts with `git fetch origin && git merge origin/<default>` on the PR branch. Poll CI every 60 seconds.

### New project setup

When bootstrapping a new project (or adding tests to one that has none):

- Aim for ≥ 80% line coverage on changed code — same threshold as established repos.
- Wire CI to run tests + coverage gate on every PR before any feature work lands.
- Branch threshold: 75% BE/agent, 90% FE. If ambiguous, ask.

### Per-request overrides

Drop the matching rule for the current request only when the user says:

- "do this one foreground" → skip background.
- "wait before starting the next" → serialize instead of parallelize.
- "skip babysit" → open the PR and stop.
- "WIP only" / "don't push" → no push, no PR.
- "single-shot" / "no worktree" → work in the main checkout.

## Secrets & Sensitive Data

Never leak secrets, credentials, or env config to any tracked file or external surface. Applies to every output channel — logs, CI summaries, PR comments, artifacts, coverage reports, error messages, debug dumps, generated docs.

42. **No secret values, ever, anywhere.** No raw env vars, API tokens, passwords, OAuth/signing keys, private hostnames, internal URLs, customer IDs, or PII in any output readable by the user, the public, or collaborators. Never `echo`/`printenv`/`env`/`set | grep` into `$GITHUB_STEP_SUMMARY`, never reference `${{ secrets.* }}` in summary/comment templates, never `console.log(process.env)`, never `JSON.stringify(req)` for objects with auth headers.
43. **Coverage and artifact scope is source + metrics only.** Coverage `include:` lists explicit source globs — never `**/*` or `.`. `exclude:` covers `.env*`, `**/secret*`, `**/credential*`, `**/*.pem`, `**/*.key`, `**/*.p12`, `assets/binaries/**`, `secrets/**`, and any fixture path with literal-looking tokens. Artifact uploads specify an explicit `path:` (e.g. `coverage/`) — never `.` or whole workspace.
44. **CI summaries and PR comments carry metrics + filenames only.** Numbers, percentages, paths, status labels — yes. File contents, env dumps, build-time config, response bodies from authenticated calls — no. Before any new step writing to `$GITHUB_STEP_SUMMARY`, posting `gh pr comment`, or uploading an artifact: audit what it can read.
45. **No catch-all artifact uploads.** Scope to the exact subdirectory needed. Never upload the whole workspace "just in case" — that's how `.env`, `~/.aws/credentials`, and node_modules with embedded keys leak into public artifacts.

## Release Commands

46. **One unified `/sy-release` — official by default, beta only on explicit signal.** Per-channel aliases (`/sy-release-stable`/`-official`/`-main`/`-master`/`-beta`) were retired — the channel decision lives in `$ARGUMENTS`. The skill picks OFFICIAL vs BETA based on: (a) the literal keyword `beta` in `$ARGUMENTS`; (b) a SHA token that **validates** via `git cat-file -e <sha>^{commit}`; (c) a non-default branch name resolvable via `git rev-parse refs/heads/<n>`, `git rev-parse refs/remotes/origin/<n>`, or `git ls-remote --exit-code origin <n>`. Anything else — unknown SHA-shaped tokens, branch-shaped strings that don't exist — must **ABORT**, never silently degrade to official. Free-form phrases ("release", "release from main", "ship a release", "cut a release", "release prod", "release stable") are all OFFICIAL. `main`/`master` as args stay OFFICIAL. Always confirm before `gh workflow run`. Never auto-pin beta to `HEAD`.
47. **Release workflows must never derive a tag from a branch ref.** Dispatching `workflow_dispatch` with `--ref main` sets `github.ref_name = "main"`. Any workflow of the form `${{ inputs.tag || github.ref_name }}` produces a `vmain` release that overwrites real versions. Before any official `gh workflow run --ref <branch>`: (a) fetch the workflow and grep for `github.ref_name` near `version:`/`tag:`/`release:`/`name:`; (b) if a `tag` `workflow_dispatch` input exists, pass `--field tag=v<version>` derived from `tauri.conf.json`/`package.json`/`Cargo.toml`/`pyproject.toml`; (c) else ABORT and tell the user to push a `v*` tag or fix the workflow. After dispatch, poll the run and confirm the tag matches `^v\d+\.\d+\.\d+(-[\w.]+)?$` — else `gh release delete` + `gh run cancel`.
48. **Every PR merge auto-triggers `/sy-release` (when the repo has a release workflow).** As soon as a PR transitions to `MERGED` on the default branch — manual squash-merge or automerge — invoke `/sy-release` against `<owner/repo>`. The skill gracefully aborts with `"no official release workflow found — aborting"` on repos without one, so this is safe to apply uniformly. **For automerge PRs (`gh pr merge --squash --auto`)**: the babysit loop must NOT stop at "green + approved" — keep polling `gh pr view --json state,mergedAt` and invoke `/sy-release` only after `state == "MERGED"`. Every PR landing on the default branch flows through `/sy-release`. The user-confirmation prompt inside `/sy-release` is the human-in-the-loop step.

## Code Review

49. **Stay consistent across follow-up reviews — never flip-flop on your own prior positions.** Your earlier reviews on a PR are the baseline for every subsequent review on that same PR.

    **Why:** Flip-flopping (Option 1 then Option 2; APPROVE → COMMENT with no new reason; concern X then contradictory concern Y on the same code) destroys reviewer trust and forces the author to redo accepted work.

    **How to apply — every time you post on a PR you've previously touched:**
    1. **Read your prior reviews and comments first.** Filter `gh api repos/<owner>/<repo>/pulls/<n>/comments` + `.../issues/<n>/comments` + `gh pr view <n> --json reviews` by your own login (`gh api user --jq .login`).
    2. **Honor every prior recommendation.** If you suggested A over B and the author picked A, do NOT now ask for B. If concern X was addressed, do NOT raise contradictory Y on the same code.
    3. **Only revise a prior position with a concrete new reason** (new info, related PR landed, security advisory, author asked you to reconsider). When you reverse, **call it out explicitly**: `"Updating my earlier suggestion (#<comment-id>) — <reason>"`. Never silently contradict yourself.
    4. **If your earlier comment was vague and the author picked a reasonable interpretation, accept it.** Don't relitigate.
    5. **Verdict consistency.** If you APPROVED earlier and new commits are still acceptable, re-APPROVE. Don't quietly downgrade to COMMENT without naming the new concern (or upgrade without acknowledging earlier concerns).

    **Scope:** Your own past reviews only. You don't have to honor a different reviewer's positions — but call out the disagreement so the author isn't whipsawed. Applies to every channel: `/sy-review-pr`, ad-hoc reviews, babysit line comments, informal "what do you think?" replies.

## Repo Identification

50. **The local folder name is not the repo — always resolve the remote.** Local folder names diverge from GitHub `owner/repo` (e.g. `~/git/file-explorer` is `synle/skiff-files`). Before any `gh` call, sub-agent spawn, PR action, or remote-aware reasoning: run `git remote get-url origin` (or `gh repo view --json nameWithOwner`) and use that as the authoritative `owner/repo`. Never derive from `basename "$(pwd)"`, `$PWD`, or the directory name. When delegating, pass the resolved `owner/repo` explicitly.

## CLAUDE.md Size Limit

51. **Keep every `CLAUDE.md` under 40,000 characters. After any change to a `CLAUDE.md` — directly or via a generator source (e.g. `claude-instructions.md`) — check size as the final step and trim if over.**

    **Why:** Claude Code loads every `CLAUDE.md` into the system prompt every turn. Over ~40k chars degrades performance, slows first-token latency, and crowds out task context.

    **Trigger:**
    - You wrote bytes to a file named `CLAUDE.md` via `Edit`/`Write`/any tool.
    - You edited a generator (e.g. `software/scripts/advanced/claude/claude-instructions.md` in `synle/bashrc` regenerates `~/.claude/CLAUDE.md`). Check the generated file's size after regeneration.
    - You added a new rule, section, example, or paragraph — even one line. Small adds accumulate.
    - The user asked you to update/append/expand a `CLAUDE.md`. Run the size check before reporting done.

    Don't skip the check just because your edit looked small. Always measure after.

    **How (no exceptions, no asking the user first):**
    1. `wc -c < <path>`. If ≤ 40,000, report size and stop.
    2. If over, trim in this order until under:
       - **Merge duplicates.** Two rules covering the same ground → combine.
       - **Cut stale incident dates and war stories** older than 6 months that no longer change behavior. Keep the rule, drop the narrative.
       - **Collapse verbose examples** to one representative line.
       - **Shorten prose.** Strip filler ("specifically", "in particular"). Multi-sentence → one tight sentence.
       - **Move deep-detail sections** (long file tables, architecture deep-dives, full command refs) into linked docs (`DEV.md`, `ARCHITECTURE.md`) and leave a one-line pointer.
    3. **Don't delete whole rules unless obsolete** — ask the user before removing any rule that still describes current behavior.
    4. **Re-check size** after trimming. Repeat until ≤ 40,000.
    5. **Report what you cut** so the user can spot-check (e.g. "40,900 → 38,200: merged 2 logging rules, removed 2026-01 incident, collapsed run.sh example block").

    **Scope:** Every `CLAUDE.md` (global `~/.claude/CLAUDE.md`, project root, nested). Not `DEV.md`, `ARCHITECTURE.md`, or other linked docs — only files literally named `CLAUDE.md`.

    **Global CLAUDE.md note:** `~/.claude/CLAUDE.md` is generated from `software/scripts/advanced/claude/claude-instructions.md` in `synle/bashrc`. To trim the global file, edit `claude-instructions.md` and re-run `claude.js` — don't hand-edit `~/.claude/CLAUDE.md` directly.
