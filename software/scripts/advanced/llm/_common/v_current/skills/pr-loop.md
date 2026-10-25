[Sy] Run the shared, bounded scheduling protocol for pull-request babysitting and review. Reuse one clock, read-only probe, resumable owner, and state handoff. The selected workflow retains its own scope, permissions, readiness or verdict policy, and pass implementation.

## Purpose

Use this protocol for asynchronous PR work, not shrinking task lists. Waiting is normal; it is neither progress failure nor success.
Existing single/batch babysit and review workflows read this contract in their current owner. Reading it never starts another scheduler or worker.

Direct invocation requires one workflow selector: `babysit-pr`, `babysit-prs`, `review-pr`, or `review-prs`, followed by that workflow's arguments in `$ARGUMENTS`.
Reject an unknown selector before starting work. Route to the selected workflow before creating a clock; that workflow remains the sole scheduling owner.
Without an expanded argument, use an explicitly named PR workflow from the request; otherwise ask which workflow and scope, then stop.
A selected workflow owns all remaining arguments, author filters, scope discovery, posting modes, and authorization.
Load its deployed `SKILL.md` under `<<LLM_ROOT_FOLDER>>/skills/sy-<selected-workflow>/`, then execute that workflow once using this protocol.
Do not call this entrypoint recursively when the selected workflow reads this contract.

## Steps

### Run selection

Before creating a clock, identify the workflow, scope kind, normalized repository/PR identities, resolved author filters, and canonical search root and discovery depth when applicable.
Normalize aliases, case-insensitive identities, and explicit-list order; keep changing search results separate from the stable scope definition.
Persist that selection beside run_id, run_lifecycle (`running`, `interrupted`, `paused`, or `completed`), clock, owner handles, and pause scope/clearing condition.
Use existing ledger locations and stable PR keys; historical PR memory alone is not an active dispatcher ledger.
Within the bounded discovery window, check stable per-PR owner keys across runs before dispatch, including owners whose set-wide scope differs.
A different scope or run_id never proves a PR unowned. Reuse an existing owner or block that PR when authority is uncertain.
Check saved pause scopes against overlapping PRs even when the new set-wide scope differs; unrelated work may continue.
Several matching ledgers or contradictory owner evidence require a bounded ambiguity report; never choose the newest ledger merely by timestamp.
An explicitly identified run still requires live owner verification; the identifier is not exclusive authority.

- One matching running or interrupted run: adopt its existing clock and recover through Owner recovery and restart.
- An interrupted expired run still requires an explicit valid new watch budget before more monitoring or passes; preserve outstanding work and counters.
- A matching explicit pause blocks only its saved scope until matching user resumption. A budget change never clears a pause.
- An audit, restart, or unrelated instruction is not resumption. A run with no stored pause is not automatically proven unpaused when contrary user instructions exist.
- A plain authorized invocation after proven completed history starts the default budget with a new run_id and launch time; no new caller token is required.
- With no matching run and no conflicting owner or pause, start a fresh authorized run. Do not inherit an unrelated historical deadline.
- Legacy or contradictory lifecycle evidence remains unknown; report the missing evidence or ask which run to recover instead of inventing completion.

A completed run needs saved finished_at and exit_reason, completed exit reconciliation, and verified evidence of no active writer and no unfinished workspace, publication, or cleanup debt.
Deadline expiry alone never proves completion. Interrupted or ownership-blocked exits remain recoverable, not completed history.
Preserve repair caps, de-duplication, automerge ownership, and unresolved decisions across fresh runs; only run-local schedule/pass counters start anew.
Fresh scheduling never authorizes retrying a capped repair or repeating a prior remote write.
Record run_lifecycle and completion evidence on every exit. A historical needs_user decision remains action-scoped under the selected workflow, not a blanket run pause.

### Clock and schedule

- Strip trailing `budget=<value>` and `keepalive=<duration>` before scope resolution. Durations accept `<n>s`, `<n>m`, `<n>h`, or combinations such as `6h40m`. Budget also accepts `<n>r` or `<n>rounds`; bare numbers are invalid.
- Require positive finite values. Invalid values retain defaults and are reported. Resolve keepalive first, then convert rounds to `n × keepalive`; rounds never become a pass quota.
- Defaults: `<<SY_PR_RUN_BUDGET_ROUNDS>>` rounds and `<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>` seconds. Clamp budget to `[10m, 24h]`, then keepalive to `[5m, budget]`. Report every clamp.
- Natural-language cadence maps to these tokens: `10 rounds 25 mins apart` means `budget=10r keepalive=25m`.
- Exactly one owner holds `started_at`, `deadline_at`, cadence, and final verification. A batch driver owns the set's clock; single-pass workers inherit it and never receive fresh clock overrides.
- Apply Owner recovery and restart before creating a new clock. For a fresh authorized run, obtain real launch time with `date` and print the schedule below.
- On recovery, print the saved first-pass time, original deadline, and remaining budget instead of announcing a new launch. Single-pass workers and review dry-runs announce no watch schedule.

```text
Schedule — <workflow>
  First round: <HH:MM local> (now)
  Last round:  ~<HH:MM local> (deadline <HH:MM>)
  Duration:    <H>h <M>m · <n> rounds × <keepalive> keepalive
  Source:      budget=<as given | default> · keepalive=<as given | default>
```

Use `ceil(budget / keepalive)` for duration-based round display. Add a `Clamped:` line when needed.
Persist the same launch time and `deadline_at = started_at + resolved budget`. Final reporting compares actual first/last pass times with the announced schedule.

### Owner and single-pass handoff

- Adopt by stable workflow/PR identity before dispatch using Owner recovery and restart. Retain verified running owners, resume idle owners, and replace only after its exclusivity checks.
- Cancel a confirmed duplicate through the supported harness mechanism, keeping the older owner. Confirm cancellation and reconcile any overlapping writes before that PR continues.
- Store resume handles immediately. A pass runs inside its current owner; never create an agent per PR per round or a nested clock.
- A queued or watched PR consumes no worker slot. Release a slot only after the current pass returns at a safe point with complete state. Never move a dirty workspace or unpushed work into quiet watching.
- Await every job dispatched or resumed in the turn. A missing detached timer means inline execution with real waits, never abandoned jobs or a shortened budget.
- `pass=single` runs one pass inline, returns state, and never sleeps or polls between passes. Only an explicit caller selects it; an agent never adds it to shorten a normal request.
- Keep existing parameter forms: babysit uses `round=<n>` plus optional `last=true`. Review accepts legacy `round=<n>/<total>` and driver form `round=<n> last=true`; normalize both to the same completed-round/cleanup state. Manual single-pass defaults remain babysit `round=1 last=true` and review `round=1/1`.
- Report and ignore unknown `key=value` tokens; never parse them as PR refs. Workflow-specific invalid goals or scopes retain their own rejection rules.
- Return a `## State` block after each pass. The driver supplies it under `## Prior state`, never a whitespace-split `state=` token. Missing prior state means round one and requires live verification, not invented ownership.
- Increment `completed_round` only after a pass finishes. An interrupted pass resumes from its last completed checkpoint; other PRs keep independent counters.
- Preserve shared state: `loop_count`, `completed_round`, `started_at`, `deadline_at`, `last_full_pass_at`, `last_poll_at`, `watch_fingerprint`, `probe_snapshot`, `probe_count`, `consecutive_noops`, `dirty_after_pass`, `pending_wake_events`, `externally_blocked`, `last_watch_verification_at`, and `wake_reason`.
- Preserve every workflow-specific state field and `needs_user` source/version, blocked/independent actions, clearing condition, and next action. Apply the selected workflow's decision scope before parking; the flag alone never proves quiet eligibility. Dirty/unpushed work remains outstanding even when a named action is blocked; preserve it without repeatedly dispatching forbidden actions. Never reset repair caps, de-duplication, workspace ownership, automerge ownership, or readiness evidence during a handoff.
- Checkpoint immediately after ownership-changing writes, pushes, or workspace allocation, not only at pass end. Only the relevant owner performs cleanup; retain durable PR memory after every exit.

### Owner recovery and restart

**Bounded discovery.** Before dispatch or recovery, read the saved ledger and latest checkpoint for each stable PR key, including prior owner handles.
Use the documented harness status interface for those identities, not repeated CLI discovery, full process dumps, transcript sweeps, or unrelated migration scans.
Allow one 60-second discovery window across the saved owners, with at most two targeted status reads per owner and one latest-checkpoint read.
Bound each call by the remaining window and watch deadline; batch reads when supported.
An empty active list, saved handle, or stale running label proves neither liveness nor termination.
Status may be session-scoped; use the saved run's canonical lifecycle and writer evidence rather than assuming the current session lists every owner.
Do not repeat discovery without new evidence. At the limit, persist one recovery decision per PR with evidence, missing proof, and next action.
Unknown ownership blocks only that PR's replacement writes; keep independently authorized PRs moving under the existing clock.

**Liveness is not progress.** Use these defaults only when the runtime exposes the corresponding signals:

| Signal                                  | Interval or threshold | Response                                                              |
| --------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Runtime heartbeat during an active pass | Every 60 seconds      | Record owner identity and current operation without waking the model. |
| Missing runtime heartbeat               | 5 minutes             | Mark suspect and perform bounded discovery, not replacement.          |
| No meaningful operation progress        | 30 minutes            | Investigate even when heartbeat remains fresh.                        |

The runtime or execution monitor must produce heartbeats during blocking calls; model messages and GitHub probes cannot provide this guarantee.
If unsupported, record heartbeat as unknown and use bounded status/checkpoint recovery; do not wait for nonexistent telemetry or invent timestamps.
Progress means a completed operation, verified operation-specific advancement, or a checkpoint containing new verified state.
Heartbeats, repeated status text, and unchanged checkpoint rewrites never advance progress.
A long operation may continue beyond the progress threshold when verified advancement and its expected deadline justify continuation within the outer budget.
Idle reusable sessions, queued PRs, and quiet external watching are not stalled workers and need no active-pass heartbeat.
These thresholds trigger investigation, never takeover. Board cadence and PR keepalive are not liveness signals.

**Safe handoff.** A confirmed unresponsive active owner may receive a graceful stop through a verified harness mechanism; routine events and status requests never justify interruption.
Bound stop confirmation by another 60 seconds and the remaining watch deadline. A stop request or terminal result alone is not writer-termination proof.
Confirm termination or effective revocation of the former writer and relevant child or remote operations before replacement writes.
Use runtime-supported atomic acquisition and fencing when available; concurrent recovery attempts must not both gain authority for the same PR.
Without enforced claims, replacement requires a verified sole controller and confirmed termination of the former writer and relevant operations.
If either exclusivity or termination remains unknown, block replacement writes and name the missing proof; never pretend a ledger entry enforces a lock.
A Markdown generation cannot revoke credentials or stop a late owner from publishing. Never delete a stale-looking lock or reset a worktree to bypass uncertainty.

| Verified condition                                     | Recovery decision                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Idle and addressable                                   | Resume the same owner with saved state after confirming no operation remains in flight.              |
| Running with verified progress                         | Retain the owner and report its operation and expected deadline.                                     |
| Stale heartbeat or progress                            | Investigate within the discovery window; do not grant write authority.                               |
| Former writer terminated or effectively revoked        | Acquire exclusive ownership before replacing an unavailable owner and recovering its remaining work. |
| Unreachable, contradictory, or unconfirmed termination | Block replacement writes, preserve state, and report ownership unknown with the exact next check.    |
| Paused                                                 | Keep paused; inspect only within explicitly authorized read-only scope.                              |
| Expired deadline                                       | Report final state; require an explicit new watch budget before further monitoring or passes.        |

**Recover state, not a fresh run.** A new invocation is a recovery entrypoint, not a fresh watch budget.
This restriction applies to a matching interrupted or paused run; proven completed history follows Run selection instead.
Preserve saved started_at, deadline_at, and cadence unless the user explicitly supplies a valid new watch budget.
An invalid override, restart, or new dispatcher never silently extends the deadline. If saved clock evidence is missing or contradictory, request explicit budget clarification.
Do not start a pass after an expired deadline, including a recovery or final worker pass; report read-only reconciliation and any verification still owed.
A user pause overrides recovery and dispatch, including timer-triggered recovery. Persist pause scope and clearing condition; only explicit user resumption clears it.
Distinguish a crash from a pause. Machine restart does not prove remote execution ended; verify the old writer's execution scope before replacement.
After exclusive ownership is established, recover interrupted Git operations, dirty edits, and unpushed commits before syncing or ordinary workflow work.
Before retrying publication, reconcile live head SHAs, comments, reviews, reactions, thread resolutions, and automerge state against the last completed checkpoint.
A crash may follow a successful remote write but precede its checkpoint. Retry only missing actions; retain repair counters and all shared/workflow state.
Persist run identity, stable job key, owner handle, active/idle state, checkpoint location, last_heartbeat_at, last_progress_at, operation, operation_started_at, and expected operation deadline.
Keep unavailable signal values explicitly unknown; legacy records require live reconciliation, not fabricated history.
Record ownership generation only when runtime acquisition enforces it, plus recovery decision, supporting evidence/time, missing proof, next action, and pause state.
Checkpoint ownership changes immediately and before a replacement performs side effects. Report resume, retain, replace, or blocked with evidence and next action.

### Partial-launch handoff

If only k requested jobs start, keep every PR enrolled and persist accepted handles plus each rejected launch's actual error.
Let healthy started passes return at a safe point; never cancel them merely because peer launches failed.
Do not inject rejected assignments into a running slot. Collect complete per-PR state and reconcile pending events before refilling free slots from the ranked queue.
Reuse eligible idle owners under the ownership contract; never create another owner for an accepted job's PR.
Accepted count k alone is not capacity evidence. Non-capacity rejection never changes S.
Lower effective concurrency only with documented capacity rejection or a verified runtime limit; never exceed the selected user/harness ceiling.
Keep transient service failures, permission/configuration errors, and capacity exhaustion distinct; retry only eligible transient failures under the shared bounded service policy.
k == 0 is a launch failure, never S = 0; report it and preserve the queue without pretending any PR was serviced.
If a started owner becomes unresponsive, use Owner recovery and restart or an explicit user stop, not a special cancellation shortcut.
A cancellation response does not prove child or remote operations stopped.
Block replacement writes until termination or effective revocation, operation reconciliation, and exclusive authority are verified.
Preserve already-pushed commits, posted artifact IDs, repair counters, and automerge ownership; retry only missing actions after live reconciliation.
A completed safe pass releases a slot; unknown writer state does not prove capacity free. Retain blocked ownership evidence and continue independent work within the clock.

### Read-only probe

Between passes, poll every `<<SY_PR_POLL_INTERVAL_SECONDS>>` seconds. Use at most two `gh` calls per PR, plus one state read per named dependency.
No checkout, diff, bulk logs, tests, worker, reply, reaction, push, merge, or automerge change belongs in a probe.
Capture the first response's raw JSON internally, then compute its digest locally; never discard fields and fetch the same snapshot again.

```bash
gh pr view <number> --repo <owner/repo> --json state,isDraft,title,body,reviewDecision,mergeable,mergeStateStatus,headRefOid,baseRefOid,autoMergeRequest,baseRefName,updatedAt,statusCheckRollup,comments,reviews \
  --jq '[.state,(.isDraft|tostring),(.reviewDecision//"none"),.mergeable,.mergeStateStatus,.headRefOid,.baseRefOid,(if .autoMergeRequest then "auto" else "noauto" end),.baseRefName,.updatedAt,((.statusCheckRollup//[])|map((.name//.context)+"="+((.conclusion//.state//.status)//"?"))|sort|join(",")),((.comments//[])|length|tostring),((.reviews//[])|length|tostring)]|join("|")'

gh api "repos/<owner>/<repo>/pulls/<number>/comments?per_page=1&sort=updated&direction=desc" \
  --jq 'if length == 0 then "none" else "\(.[0].id):\(.[0].updated_at)" end'
```

- The displayed `--jq` demonstrates local reduction. Callers needing field-level classification omit it from the first request and derive the same digest from that response.
- Compare both digest strings and retain full head/base SHAs. Displayed short hashes never become identity keys.
- `comments` contains issue comments, not line comments. The second call detects the newest updated line comment without paginating every comment at each tick.
- Named wave blockers, companions, and parent PRs get a live state read; reuse that response for classification and pulse rendering.
- Fingerprint changed → apply the selected workflow's wake policy. Fingerprint unchanged → record a read-only tick, report blocker/next-check/remaining budget, and wait again.
- A digest is an event hint, not readiness proof. Reaction-only changes, thread resolution, required-check policy changes, and dependency discovery still require bounded keepalive/final verification.
- Reuse pulse snapshots; never issue duplicate status reads solely to render the board. Ordinary ticks retain the two-call cap; bounded verification may exceed it.

### Lifecycle and termination

- Round one is always a full pass unless the selected workflow's explicit dry-run/single-pass mode applies. A scope skip ends the pass, not the watch.
- Poll after each pass. Exclude the owner's own writes from inbound-event decisions; they never create a self-sustaining loop.
- Never interrupt an active pass except through Owner recovery and restart or an explicit user stop. Routine incoming events wait for a safe point.
- Record relevant incoming events and source/head versions, let the owner finish safely, then reconcile against its returned snapshot. Collapse only unconsumed events into one follow-up.
- Never overwrite a newer driver observation with an older worker snapshot. Preserve pending events until consumed or proven no longer actionable.
- Verify at least every resolved keepalive interval and before the deadline. Harmless progress never postpones verification. Schedule from the latest completed full pass or watch verification.
- All waits, in-pass CI monitors, retries, and merge waits share the outer deadline. Reserve final verification before it; do not start another pass after it. Finish an active pass safely and report any actual overrun.
- Wait using a real blocking `sleep`, bounded by the next due event and remaining deadline. If interrupted early, measure and wait only the remainder. Never simulate elapsed time, busy-poll, or shorten the requested watch.
- A quiet round, absent detached timer, or green snapshot never ends a watch goal. A parked `needs_user` decision remains watched and revalidated; it is never marked successful or posted as scheduler state on GitHub.
- `MERGED`/`CLOSED` ends that PR's rotation and invokes only required owner cleanup. Other per-PR exits come from the selected workflow: verified ready goals or bounded repair escalation, never generic inference.
- Explicit-ref batches may finish when every selected PR reaches its workflow-defined completion outcome. Search scopes re-resolve at each pulse, enroll new matches, and sleep through empty or fully terminal sets until the deadline.
- Retry unreachable GitHub/model service calls up to `<<SY_PR_RETRY_MAX_FAILURES>>` consecutive attempts, `<<SY_PR_RETRY_INTERVAL_SECONDS>>` seconds apart, within the outer deadline. A recovered attempt resets the service-failure counter, never repair counters. If the deadline arrives before the service-attempt cap, report deadline and the actual failed count, not service exhaustion.
- Exhausted service retries stop with `GitHub or model service unreachable — stopping with resumable state`. Report actual evidence, not an invented network cause.
- On every exit, persist shared and workflow-specific state, unresolved ownership, counters, exact last evidence, and next action. Report passes, probes, elapsed/planned budget, exit reason, and cleanup status.
- Batch pulse layout and ranking remain owned by the existing list/dispatcher contracts. Keep the opening, periodic, and closing pulse; rendering never dispatches or interrupts a worker.

### Batch pulse

Render the existing list workflow's ping-pong board before dispatch, every 10 minutes, and once at exit.
Keep the same scope token and current ledger, including slot/queue position, pass counts/times, next-check ETA, and last rendered snapshot.
Include available heartbeat age, current-operation duration, last verified progress, and recovery decision in the existing Agent cell; show unavailable liveness as unknown.
Refresh status from the shared probe's live response and returned worker results; never message an active owner for progress.
A pulse only renders: it never dispatches, retries, cancels, posts, merges, or changes verdicts. Recovery occurs outside rendering.
Keep watching and non-terminal skipped rows live. Dead owners are reported, then recovered by the scheduling owner under its existing rules.
The periodic board does not replace the shorter probe cadence, and a sleeping pulse never holds a worker slot.

### Workflow adapters

| Workflow         | Local policy that stays outside this scheduler                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned-PR babysit | Readiness contract, ready/watch goal, repair/sync permissions, attempt caps, workspace lifecycle, automerge decisions, and Step 12b actionable-event/quiet-verification policy.                                   |
| PR review        | Author filters, skip/de-duplication, verdict/posting permissions, dry-run behavior, and full passes on external fingerprint changes, keepalive, and final verification. A clean review is not a ready/merge exit. |
| Batch drivers    | Scope discovery, ranking, concurrency, ledger/pulse rendering, and passing the selected workflow policy and complete per-PR state to existing owners.                                                             |

The driver may collect read-only evidence but never performs a worker-only action.
A review driver never inherits babysit's quiet read-only verification instead of its required full review passes.
A babysit driver applies the same actionable-event classifier as standalone babysit, including closeout debt and required-bot readiness events.
Under single-pass slot mode, CI monitoring yields after at most one observation and one repair attempt; counters persist across passes.
A single-PR slot may use normal in-pass monitoring only when no peer waits, the driver permits it, and the shared deadline still applies.

## Safety

Never:

- Start monitoring without explicit PR-work authorization, or treat reading this shared contract as new authorization.
- Use this protocol for a shrinking-work task loop or wrap it in that loop's progress/stall rules.
- Change the selected workflow's author scope, dry-run behavior, mutation permissions, approval gates, or readiness/verdict semantics.
- Turn missing/unknown evidence, a quiet tick, exhausted budget, or parked decision into success.
- Reset durable retry counters or erase local work to recover a scheduler.
- Modify repository protections, execute production migrations, merge, release, or post GitHub scheduler markers from the shared layer.
- Interrupt another owner's work outside Owner recovery and restart or an explicit user stop, or destroy dirty/unpushed state during cleanup.
- Treat elapsed time, an empty active list, or a stale-looking lock as exclusive write authority.

Stop and ask when workflow selection, scope, ownership, or a required permission is ambiguous; preserve state and leave existing PRs untouched.
An in-run decision restricts only affected actions under the selected workflow's rules; continue independently authorized work and the existing watch. A readiness gap is not repair authority or a repair veto.

## Verification

Before reporting completion, quote actual check/probe output, not an expected result.
Record the selected workflow, clock owner, goal, first/last pass times, head/base snapshot, pass/probe counts, and exit reason.
Show one owner per PR, preserved handoff counters, final verification type/result, and cleanup owed or completed.
For recovery, report bounded discovery/stop duration, signal availability, writer/exclusivity evidence, clock/pause preservation, reconciliation results, and any ownership-unknown blocker.
For babysit readiness, report every gate's fresh evidence; for review, report posted versus proposed artifacts under its existing rules.
No instruction-only check proves runtime enforcement, live bot compatibility, or atomic merge safety.
