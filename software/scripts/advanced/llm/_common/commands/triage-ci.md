[Sy] Triage a red CI run that has no PR behind it — default-branch breakage, a nightly, a scheduled job, or a release workflow. Identifies the breaking change, then fixes forward or reverts.

Argument: $ARGUMENTS (optional — a run URL, a run ID, a workflow name, or a branch. If empty, take the most recent failing run on the default branch.)

## When to use

- The default branch is red and there is no PR to babysit.
- A nightly, cron, or scheduled workflow started failing.
- A release or publish workflow failed after a merge.
- CI is red on a branch nobody has opened a PR for yet.

For a red PR, use `/sy-babysit-pr` — it owns the address-comments + drive-CI-green loop. This command covers the gap where no PR exists, so there is nothing to babysit.

## Priority rule

**A red default branch blocks everyone.** Every minute it stays red, someone branches from broken code, someone's unrelated PR shows a failure they did not cause, and the signal everyone relies on stops meaning anything. Restoring green outranks fixing it elegantly: if the cause is not understood within a short pass, **revert first and investigate after** — a revert is cheap, reversible, and immediately unblocks everyone, while a forward-fix authored under pressure is how the second outage starts.

## Steps

### 1. Resolve the failing run

Resolve `owner/repo` first (see the Repo Identification rules).

```bash
gh run list --repo <owner/repo> --branch <default> --status failure --limit 10 \
  --json databaseId,name,conclusion,headSha,createdAt,event,url
gh run view <run-id> --repo <owner/repo> --json status,conclusion,headSha,jobs,url
```

Establish immediately, and report it:

- **Is it still red?** A later run may already be green — the failure was transient or someone fixed it. Say so and stop.
- **How long red?** `gh run list --branch <default> --limit 30` — first failing run marks the start.
- **How many runs failed in a row?** One is possibly flaky; three consecutive is a real break.

### 2. Read the actual failure

```bash
gh run view <run-id> --repo <owner/repo> --log-failed
```

**Read the FIRST failure, not the last** (see the Debugging Discipline rules) — CI logs cascade, and the final lines are usually a summary step reporting that an earlier step failed. Extract the error verbatim; never paraphrase it.

Classify before acting, because the response differs sharply:

| Class                   | Signal                                                                                    | Response                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Code break**          | a test or build fails deterministically on the merged code                                | Step 3                                                   |
| **Flake**               | same commit passed before / passes on re-run; timing, ordering, or network in the message | Step 6 — re-running is not the fix                       |
| **Environment**         | image, runner, toolchain version, or action version moved with no repo change             | Step 5                                                   |
| **Dependency drift**    | an unpinned transitive dep published a new version                                        | Step 5                                                   |
| **Secret / credential** | 401/403, expired token, rotated key                                                       | Escalate to a human — do not attempt to mint credentials |
| **Infra**               | GitHub incident, runner shortage, registry outage                                         | Confirm on the status page, wait, do not patch code      |

### 3. Find the breaking change

The failing run's `headSha` and the last green run's `headSha` bracket the cause:

```bash
gh run list --repo <owner/repo> --branch <default> --status success --limit 5 --json headSha,createdAt
git --no-pager log --oneline <last-green-sha>..<first-red-sha>
```

- **One commit in the range** — that is the cause. Read its diff.
- **Several commits** — read them newest-first for one whose diff plausibly touches the failing area, then confirm by reproducing locally against that specific SHA. Do not accept a plausible-looking commit without confirming (see the Debugging Discipline rules on one hypothesis at a time).
- **Zero repo commits in the range** — nothing in the code changed, so the cause is environmental: Step 5.

### 4. Reproduce locally

In a dedicated worktree, never the primary checkout (see the worktree rules):

```bash
WT="$(git worktree-path ci-triage)"   # $HOME/.worktrees/<owner>/<repo>/<repo>__branch-ci-triage
mkdir -p "$(dirname "$WT")"
git worktree prune
git fetch origin && git worktree add --detach "$WT" <first-red-sha>
```

A specific SHA is the one case `git create-worktree` does not cover — it takes a branch, not a commit — so compute the path with `git worktree-path` and detach onto the SHA yourself. The layout stays identical either way.

Run the same command the failing CI step ran, matching its environment as closely as the local machine allows (same runtime version, same env vars, `CI=true` — many suites change behavior under it).

If it will not reproduce locally, the difference _is_ the bug: OS, runtime version, an env var, a missing secret, clean-checkout state, cache, parallelism, or test ordering. Chase that difference rather than concluding "works on my machine".

### 5. Environment and dependency causes

No repo change in the range means something outside it moved:

- **Action versions** — a `@v4`-style floating tag republished. Compare the action SHA in the last green run against the red one. Pin to a SHA.
- **Runner image** — `ubuntu-latest` rolled. The runner image version is printed at the top of the job log; diff it against the green run's.
- **Toolchain** — a floating language version moved. Pin it.
- **Transitive dependency** — an unpinned dep published. `git diff` the lockfile if one is committed; if none is, that is the underlying defect and committing one is the real fix.
- **External service** — a registry, package host, or API the build calls. Check its status page before touching anything.

Fix by pinning the thing that floated. Say plainly that the repo code was never the problem.

### 6. Flakes are bugs, not weather

Never close a flake by re-running until green — that trains everyone to click past real failures, and the flake will resurface at the worst moment. Identify the nondeterminism: a real clock, a random seed, a port collision, test-order dependence, an unawaited promise, a shared fixture, a network call in a unit test. Fix that. If it genuinely cannot be fixed now, quarantine it with a linked issue and a date, and say so out loud — a silent quarantine is a deleted test. (See the Test Quality rules.)

### 7. Fix forward or revert

**Revert when:** the cause is a single identifiable commit and the fix is not obvious within a short pass; the default branch has been red for a while; a release is blocked; or the author is unavailable. Reverting someone's commit is not an insult — it is the cheapest path back to green, and their change relands with the fix included.

```bash
git revert <sha>          # or: gh pr revert
```

Follow the rollback rules: title `Revert "<original title>"`, body linking the original commit and the failing run, CI green required, review loop skipped.

**Fix forward when:** the cause is understood and the fix is small and obviously correct — a missing import, a stale snapshot, a version pin, an off-by-one in an assertion.

Either way: real commit message describing what actually changed (never `fix ci`), a regression test if the failure was a code break and the failure mode is testable, and no unrelated changes riding along.

### 8. Confirm green and close out

Watch the run to completion — do not declare victory on a push:

```bash
gh run watch <new-run-id> --repo <owner/repo>
```

Report:

- **Failure** — the verbatim first error.
- **Cause** — the commit or environment change, with evidence.
- **Class** — code break / flake / environment / dependency / infra.
- **Action** — reverted or fixed forward, and why that choice.
- **Red for** — how long, and how many runs failed.
- **Prevention** — the pin, the test, or the check that would have caught it. If a pre-merge gate would have caught this and does not exist, say so; that is usually the most valuable output of the whole triage.
- **Still unknown** — anything unexplained. A run that went green without an understood cause is reported as exactly that, never as "fixed".
