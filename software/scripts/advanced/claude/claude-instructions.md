# Engineering Principles

Stack-agnostic rules. Apply across every language, framework, and codebase.

## Source Control & PRs

1. Branch from a fresh default. Pull right before branching. Task-scoped name. Never branch off a feature branch.
2. Squash on merge — one PR, one commit. **Applies to manual merges AND automerge.** Always `gh pr merge --squash` (or `gh pr merge --squash --auto` to enable automerge). Never merge commits, never rebase merges. If a repo's default automerge mode is anything other than squash, switch the call to explicit `--squash` or fix the repo setting.
3. Sync with `git merge origin/<default>`. Never rebase or force-push shared branches.
4. Each PR is a standalone, mergeable unit. Bundle tightly-coupled changes (API + schema + models). Never stack PRs.

## Code Hygiene

5. Fix root causes, not symptoms. Three identical defensive blocks → extract or fix the invariant.
6. Keep comments, titles, and docstrings in sync with the code in the same edit.
7. Delete leftovers in the refactor PR — unused imports, mocks, props, dead helpers. Audit the matching test file.
8. Skip no-op wrappers; factor near-duplicates. Passthroughs are noise; N literals differing in a few fields aren't.
9. Imports and declarations at the top. Lazy only for circular deps or cold-start, with a comment.
10. **Always add or update inline documentation for every method, function, class, and exported symbol you touch.** Use the language-native style: JSDoc for JavaScript (`/** ... */` with `@param`, `@returns`, `@throws`); TSDoc for TypeScript (same syntax — types come from the signature, but a one-line description is still required); Python docstrings (PEP 257 `"""..."""` immediately under the `def`, Google/NumPy `Args:` / `Returns:` / `Raises:` sections); Rust `///` doc comments (`# Arguments` / `# Returns` / `# Errors`); Go `// FuncName ...` package doc starting with the identifier; bash `#` comment one line above the function — `funcName: short description` plus a block for non-trivial helpers; Java/Kotlin Javadoc (`@param`, `@return`, `@throws`); Swift `///`; Ruby YARD; C#/PHP/etc. — use the doc-comment dialect the language ecosystem expects. Each block must cover: one-line description (what it does, not how), every parameter (name + meaning), return value + type, raised errors / exceptions, and any side effects. When you change a signature, behavior, or contract — update the doc in the same edit. Adding undocumented public methods OR leaving a stale doc next to modified code is a code-review block. Trivial one-line internals that are self-evident from the name (`function isEmpty(x) { return !x; }`) can skip the block; everything else cannot.

## Logging & Errors

10. Parameterized logging only — pass values as arguments, not formatted strings.
11. Catch the narrowest expected exception. Catch-all swallows real bugs.
12. Catch by type or status code, never by error-message string.
13. Silent catch-and-pass in diagnostic, rollback, or alert paths is a bug. Log at warning level with the original exception attached.
14. Preserve the original stack trace when re-raising. Don't reconstruct an exception from its message.
15. Don't leak raw exceptions to clients. Generic message externally; raw details server-side only. Identifiers in URLs, paths, or workflow keys are PII — log non-identifying discriminators.

## Security

16. Parameterize all queries and commands — even "internal" inputs. Never interpolate user data into a query, shell command, or RPC string.
17. URL-encode interpolated path and query params. Signatures accept arbitrary strings.
18. Sanitize at trust boundaries. HTML via a sanitizer; validate `href` protocols; reject empty / absolute / `..` / leading-dot filenames.

## Defensiveness

19. Fail-closed on missing permissions or feature flags.
20. Allowlist inputs; reject unknowns. Default-branch fallthrough is a leak hazard.
21. Check input shape before reading fields. Non-object payloads must be rejected before field access, not coerced into an empty default.
22. Treat empty values (`0`, empty string, empty collection, `false`) as valid, not absent. Test for absence explicitly; never use truthy gates to mean "is set".
23. Bound numerics on both sides — clamp to `[MIN, MAX]`. One-sided clamps let negatives or overflows through.

## Concurrency & Resources

24. One try/catch per batch iteration — outer-only discards earlier successes.
25. Chunk unbounded list params. Query and packet-size limits will bite.
26. Emit heartbeats from long-running jobs or the scheduler will kill and retry them.
27. Register teardown for async resources — timers, intervals, abort controllers, handles, sessions, pools.
28. No long synchronous retry chains in request handlers. One attempt; queue the rest.
29. Hoist loop-invariant work — permission lookups, regex compiles, deadline math.

## Tests

30. Tests must fail for the right reason — pick assertions only the correct path can satisfy.
31. For ordering contracts, assert call order, not just that both calls happened.
32. Test the symmetric path when changing one of a pair — create↔update, attach↔detach, lock↔unlock, success↔failure.

## Codebase Onboarding

48. **Read DEV.md and the architecture doc before starting non-trivial work in a repo.** Two canonical map docs sit alongside CLAUDE.md: `DEV.md` (dev setup + how the system executes — layer breakdown, data flow, where to add new code) and an architecture doc (important files, paths, and notes worth knowing — either a standalone `ARCHITECTURE.md` at the repo root, or an "Architecture" / "Key Files" section embedded inside `CLAUDE.md`). CLAUDE.md captures the rules; DEV.md + the architecture doc are the map. Applying rules without the map produces locally-correct but architecturally-wrong changes. Locate and skim both at the start of any unfamiliar task. If a repo is missing either, flag it as a gap worth filling rather than guessing structure from `ls`.

## Change Execution Workflow

How any "work on a change" request should be executed. Follow exactly unless overridden in the same message.

TL;DR: worktree-isolated, master-fresh at every gate (pre-work, pre-PR, pre-iteration), fan-out in parallel, in the background, tests-first PRs, babysit every PR to green.

33. Always use a git worktree. Each unit of work runs in its own isolated worktree (e.g. spawn sub-agents with `isolation: "worktree"`). Never modify the main checkout during parallel work — sub-agents must not trample each other or the working tree.
34. **Always sync with latest default branch at three mandatory gates.** Run `git fetch origin && git merge origin/<default>` and resolve any conflicts at each of these checkpoints — stale base = merge pain, redundant re-implementation, and CI failures against code already fixed upstream:
    - **Gate 1 — Before work starts.** In the main checkout or worktree, and before spawning any sub-agent: `git checkout <default> && git pull --ff-only`, then cut the branch. Always `--ff-only` — if the pull fails because your local default has diverged from origin (typically a stray local commit on `main`/`master`), STOP and reconcile (`git reset --hard origin/<default>` after confirming no unmerged local work, or rebase the stray commit onto a fresh branch). Never let a merge commit land on the default branch itself. Sub-agents inherit this — they must not start coding on a stale base.
    - **Gate 2 — Right before opening the PR.** Re-sync the feature branch with `origin/<default>` immediately before `gh pr create`. The diff must be against current HEAD, not whatever was tip-of-tree when you started. (Load-bearing primarily when the user has invoked the _"skip babysit"_ override from § Per-request overrides — otherwise Gate 3 covers this on the first babysit cycle.)
    - **Gate 3 — Before every iteration.** Every time you address a review comment, fix a CI failure, rebuild after feedback, or push any follow-up commit: `git fetch origin && git merge origin/<default>` first. Patch the current state of the branch, not yesterday's. (This is the same rule the babysit loop in rule 39 already enforces — it applies to manual iterations too.)
      Skipping any gate is a regression. If the merge surfaces conflicts, resolve them before continuing — never push past a conflicted state, and never `--strategy=ours` away upstream changes you haven't read.
35. Always parallelize within a single session. When several independent changes come in one request, fan them all out simultaneously — one message, multiple sub-agent tool calls. Do not serialize independent work.
36. Always run them in the background. Sub-agents should run with `run_in_background: true` so the main thread isn't blocked.
37. For phased work, parallelize within a phase; serialize between phases. If Phase 2 genuinely depends on Phase 1, fan out all Phase 1 work in parallel/background, wait for that phase to complete, then fan out all Phase 2 work in parallel/background. Never serialize within a phase.
38. PR order is fixed: tests first, then coverage gate, then push. Every PR starts by adding tests. Confirm the changed-code coverage gate passes — **≥ 80% line coverage; branch threshold 75% for BE/agent repos, 90% for FE repos** — before pushing. No PR without tests.
39. Babysit every PR all the way through to green CI. Use the `/babysit-pr` / `/babysit-prs` skills. "PR opened" is not "done." Every babysit cycle (rebuild, code edit, test fix, responding to a comment) begins with `git fetch origin && git merge origin/master` on the PR branch. Poll CI every 60 seconds, not 90.

### New project setup

When bootstrapping a new project (or adding tests to a project that has none):

- Aim for ≥ 80% line coverage on the changed code — same threshold as established projects.
- Set up the test pipeline early — wire CI to run tests + the coverage gate on every PR before any feature work lands. A repo without a coverage gate silently drifts below threshold.
- Pick the branch threshold based on repo type: 75% for backend/agent, 90% for frontend. If the repo type is ambiguous, ask.

### Per-request overrides

Drop the matching rule for the current request only when the user says any of:

- "do this one foreground" → skip background.
- "wait before starting the next" → serialize instead of parallelize.
- "skip babysit" → open the PR and stop.
- "WIP only" / "don't push" → no push, no PR.
- "single-shot" / "no worktree" → work in the main checkout.

## Secrets & Sensitive Data

Never leak secrets, credentials, or environment config to any tracked file or external surface. These rules apply to every output channel — logs, CI job summaries, PR comments, workflow artifacts, coverage reports, error messages, debug dumps, generated docs, anywhere.

40. **No secret values, ever, anywhere.** No raw env vars, API tokens, passwords, OAuth keys, signing keys, private hostnames, internal URLs, customer IDs, or PII in any output the user, the public, or other repo collaborators can read. Specifically: never `echo`/`printenv`/`env`/`set | grep` into `$GITHUB_STEP_SUMMARY`, never reference `${{ secrets.* }}` in summary/comment templates, never `console.log(process.env)`, never `JSON.stringify(req)` for objects that include auth headers.
41. **Coverage and artifact scope is source + metrics only.** Coverage `include:` should list source globs explicitly — never `**/*` or `.`. `exclude:` must cover `.env*`, `**/secret*`, `**/credential*`, `**/*.pem`, `**/*.key`, `**/*.p12`, `assets/binaries/**`, `secrets/**`, and any fixture path containing literal-looking tokens. Artifact uploads (`actions/upload-artifact`) must specify an explicit `path:` (e.g. `coverage/`) — never `.` or the whole workspace.
42. **CI summaries and PR comments carry metrics + filenames only.** Numbers, percentages, paths, status labels — yes. File contents, env dumps, build-time-generated config, response bodies from authenticated calls — no. Before adding any new step that writes to `$GITHUB_STEP_SUMMARY`, posts a `gh pr comment`, or uploads an artifact, audit exactly what it can read: if a prior step generated config files containing credentials, scope the new step to exclude those paths.
43. **No catch-all artifact uploads.** When a CI step generates output you want to publish, scope the upload to the exact subdirectory you need. Never upload the whole workspace "just in case" — that's how `.env`, `~/.aws/credentials`, and node_modules with embedded keys leak into public artifacts.

## Release Commands

44. **One unified `/sy-release` slash command — official by default, beta only on explicit signal.** There is exactly ONE release entry-point: `/sy-release`. The per-channel aliases (`/sy-release-stable`, `/sy-release-official`, `/sy-release-main`, `/sy-release-master`, `/sy-release-beta`) were retired 2026-05-13 — they were noise in the slash-command picker and the channel decision lives in `$ARGUMENTS` anyway. The skill picks OFFICIAL vs BETA based on: (a) the literal keyword `beta` in `$ARGUMENTS`; (b) a SHA token that **validates** via `git cat-file -e <sha>^{commit}` against the actual repo; (c) a non-default branch name that resolves via `git rev-parse refs/heads/<name>`, `git rev-parse refs/remotes/origin/<name>`, or `git ls-remote --exit-code origin <name>`. Anything else — including unknown tokens that look like a SHA but don't resolve, or branch-shaped strings that don't exist — must **ABORT**, never silently degrade to official. Free-form phrases like "release", "release from main", "ship a release", "cut a release", "release prod", "release stable" are all OFFICIAL. `main` and `master` as args stay OFFICIAL (they're the default branch, no SHA pinning). Always confirm with the user before `gh workflow run`. Never auto-pin beta to `HEAD`.
45. **Release workflows must never derive a tag from a branch ref.** Dispatching a `workflow_dispatch` with `--ref main` sets `github.ref_name = "main"`. Any workflow expression of the form `${{ inputs.tag || github.ref_name }}` will produce a `vmain` release that overwrites real versions (incident: 2026-05-10, `synle/display-dj` clobbered three v7.0.x releases). Before any official `gh workflow run --ref <branch>`: (a) fetch the workflow file and grep for `github.ref_name` near `version:` / `tag:` / `release:` / `name:`; (b) if a `tag` `workflow_dispatch` input exists, always pass `--field tag=v<version>` derived from `tauri.conf.json` / `package.json` / `Cargo.toml` / `pyproject.toml`; (c) if neither is possible, ABORT and tell the user to push a `v*` tag or fix the workflow. After dispatch, poll the run and confirm the resolved tag matches strict semver `^v\d+\.\d+\.\d+(-[\w.]+)?$` — if not, immediately advise `gh release delete` + `gh run cancel`.

46. **Every PR merge auto-triggers `/sy-release` (when the repo has a release workflow).** As soon as a PR transitions to `MERGED` on the default branch — manual squash-merge or automerge landing — invoke `/sy-release` against `<owner/repo>`. The skill defaults to OFFICIAL from the default branch (rule 44) and gracefully aborts with `"no official release workflow found — aborting"` on repos without one, so this is safe to apply uniformly: dotfiles / infra-only repos no-op, app repos (Tauri, Electron, npm packages, Docker images) get a release dispatched. **For automerge PRs (`gh pr merge --squash --auto`) specifically**: the babysit loop must NOT stop at "green + approved" — keep polling `gh pr view --json state,mergedAt` and invoke `/sy-release` only after observing `state == "MERGED"`. Treat this as the default contract: every PR landing into the default branch flows through `/sy-release`. The user-confirmation prompt inside `/sy-release` (rule 44) remains the human-in-the-loop step; the agent only queues the release intent.

## Code Review

48. **Stay consistent across follow-up reviews — never flip-flop on your own prior positions.** Your earlier reviews on a PR are the baseline for every subsequent review on that same PR.

    **Why:** Flip-flopping (suggesting Option 1 in one review, then Option 2 in the next; downgrading APPROVE → COMMENT with no new reason; raising concern X in one pass and contradictory concern Y in the next on the same code) destroys reviewer trust and forces the author to redo work that was already accepted. It is one of the fastest ways to lose credibility on a team.

    **How to apply — every time you post a review, line comment, or PR comment on a PR you have previously touched:**
    1. **Read your own prior reviews and comments first.** Filter `gh api repos/<owner>/<repo>/pulls/<number>/comments` + `.../issues/<number>/comments` + `gh pr view <n> --json reviews` by your own `gh api user --jq .login`. Skim everything you said before.
    2. **Honor every prior recommendation.** If you suggested "go with approach A over approach B" and the author picked A, do NOT now ask them to switch to B. If the author addressed concern X you raised, do NOT raise contradictory concern Y on the same code.
    3. **Only revise a prior position when you have a concrete new reason** — new info has surfaced, a related PR landed, a security advisory dropped, or the author explicitly asked you to reconsider. When you do reverse, **call it out explicitly** in the new comment: `"Updating my earlier suggestion (#<comment-id>) — <new reason>"`. Never silently contradict yourself.
    4. **If your earlier comment was vague and the author picked a reasonable interpretation, accept it.** Don't relitigate just because a different reading was possible.
    5. **Verdict consistency.** If you APPROVED earlier and the new commits are still acceptable, re-APPROVE. Don't downgrade to COMMENT without naming the specific new concern. Same for the other direction — don't quietly upgrade COMMENT → APPROVE without acknowledging that you previously had concerns.

    **Scope:** Applies to your own past reviews only. You don't have to honor a different reviewer's positions when they conflict with yours — but call out the disagreement explicitly so the author isn't whipsawed between reviewers. Applies to every review channel: `/sy-review-pr`, ad-hoc reviews, line comments during babysit, even informal "what do you think?" responses on a PR.

## Repo Identification

46. **The local folder name is not the repo — always resolve the remote.** Local folder names sometimes diverge from the GitHub `owner/repo` (example: `~/git/file-explorer` is actually `synle/skiff-files`; a previous incident, 2026-05-10, sent fix/babysit agents to the wrong remote because they assumed folder = repo). Before any `gh` call, sub-agent spawn, PR action, or remote-aware reasoning: run `git remote get-url origin` (or `gh repo view --json nameWithOwner`) and use that as the authoritative `owner/repo`. Never derive the repo from `basename "$(pwd)"`, `$PWD`, or the directory name. When delegating to sub-agents, pass the resolved `owner/repo` explicitly so they don't re-infer from the folder.

## CLAUDE.md Size Limit

47. **Keep every `CLAUDE.md` under 40,000 characters. Every time you write to, edit, append to, or otherwise modify a `CLAUDE.md` file — INCLUDING when the change is made indirectly by editing a generator source like `claude-instructions.md` — check its size as the final step of that change and trim if over the limit.**

    **Why:** Claude Code loads every `CLAUDE.md` into the system prompt on every turn. Files over ~40k chars degrade performance, slow first-token latency, and crowd out room for actual task context. A bloated CLAUDE.md hurts every future session in that repo.

    **Trigger — apply this rule whenever ANY of the following happens:**
    - You used `Edit`, `Write`, or any other tool that wrote bytes to a file named `CLAUDE.md`.
    - You edited a file that generates a `CLAUDE.md` (e.g. `software/scripts/advanced/claude/claude-instructions.md` in `synle/bashrc` regenerates `~/.claude/CLAUDE.md`). In that case, check the generated file's size after regeneration.
    - You added a new rule, section, example, or paragraph to a `CLAUDE.md` — even a one-line addition. Small adds accumulate.
    - The user asks you to update, append to, or expand a `CLAUDE.md`. Run the size check before reporting the task done.

    Do NOT skip the check just because your edit looked small or because the file looked "fine before." Always measure after the change.

    **How to apply — run after every edit (no exceptions, no asking the user first):**
    1. **Check the size.** Run `wc -c < <path>` on the file you just edited (or, for generator sources, on the generated `CLAUDE.md`). If ≤ 40,000 chars, you're done — report the size in your final message and stop.
    2. **If over 40,000 chars, trim in this order until under the limit:**
       - **Merge duplicates.** Two rules covering the same ground → combine into one.
       - **Cut stale incident dates and one-off war stories** that are older than 6 months and no longer change behavior. Keep the rule, drop the historical narrative.
       - **Collapse verbose examples** to a single representative line. Keep "what to do" and "what not to do"; drop the third and fourth variations.
       - **Shorten prose.** Strip filler ("specifically", "in particular", "as a matter of fact"). Convert multi-sentence explanations into one tight sentence.
       - **Move deep-detail sections** (long file tables, architecture deep-dives, full command references) into linked docs (`DEV.md`, `ARCHITECTURE.md`, etc.) and replace with a one-line pointer.
    3. **Do NOT trim by deleting whole rules unless you're sure they're obsolete** — ask the user before removing any rule, convention, or guidance that still describes current behavior.
    4. **Re-check size** after trimming. Repeat until `wc -c < <path>` reports ≤ 40,000.
    5. **Report what you cut** in your response so the user can spot-check (e.g. "Trimmed CLAUDE.md from 40,900 → 38,200 chars: merged 2 duplicate logging rules, removed 2026-01 incident narrative, collapsed run.sh example block").

    **Scope:** Applies to every `CLAUDE.md` in any repo — global (`~/.claude/CLAUDE.md`), project root, and nested subdirectory CLAUDE.md files. Does NOT apply to `DEV.md`, `ARCHITECTURE.md`, or other linked docs — only files literally named `CLAUDE.md`.

    **Note on global CLAUDE.md:** `~/.claude/CLAUDE.md` is generated from `software/scripts/advanced/claude/claude-instructions.md` in `synle/bashrc` (per the `claude-instructions.md is source of truth` rule). To trim the global file, edit `claude-instructions.md` and re-run `claude.js` — do not hand-edit `~/.claude/CLAUDE.md` directly.
