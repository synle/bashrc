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

### Clock and schedule

- Strip trailing `budget=<value>` and `keepalive=<duration>` before scope resolution. Durations accept `<n>s`, `<n>m`, `<n>h`, or combinations such as `6h40m`. Budget also accepts `<n>r` or `<n>rounds`; bare numbers are invalid.
- Require positive finite values. Invalid values retain defaults and are reported. Resolve keepalive first, then convert rounds to `n × keepalive`; rounds never become a pass quota.
- Defaults: `<<SY_PR_RUN_BUDGET_ROUNDS>>` rounds and `<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>` seconds. Clamp budget to `[10m, 24h]`, then keepalive to `[5m, budget]`. Report every clamp.
- Natural-language cadence maps to these tokens: `10 rounds 25 mins apart` means `budget=10r keepalive=25m`.
- Exactly one owner holds `started_at`, `deadline_at`, cadence, and final verification. A batch driver owns the set's clock; single-pass workers inherit it and never receive fresh clock overrides.
- Before dispatch or the first pass, obtain real launch time with `date` and print the schedule below. Single-pass workers and review dry-runs announce no watch schedule.

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

- Adopt by stable workflow/PR identity before dispatch. Keep a running owner, resume an idle owner, and replace only a confirmed failed/cancelled/gone owner. Cancel a confirmed duplicate, keeping the older owner.
- Store resume handles immediately. A pass runs inside its current owner; never create an agent per PR per round or a nested clock.
- A queued or watched PR consumes no worker slot. Release a slot only after the current pass returns at a safe point with complete state. Never move a dirty workspace or unpushed work into quiet watching.
- Await every job dispatched or resumed in the turn. A missing detached timer means inline execution with real waits, never abandoned jobs or a shortened budget.
- `pass=single` runs one pass inline, returns state, and never sleeps or polls between passes. Only an explicit caller selects it; an agent never adds it to shorten a normal request.
- Keep existing parameter forms: babysit uses `round=<n>` plus optional `last=true`. Review accepts legacy `round=<n>/<total>` and driver form `round=<n> last=true`; normalize both to the same completed-round/cleanup state. Manual single-pass defaults remain babysit `round=1 last=true` and review `round=1/1`.
- Report and ignore unknown `key=value` tokens; never parse them as PR refs. Workflow-specific invalid goals or scopes retain their own rejection rules.
- Return a `## State` block after each pass. The driver supplies it under `## Prior state`, never a whitespace-split `state=` token. Missing prior state means round one and requires live verification, not invented ownership.
- Increment `completed_round` only after a pass finishes. An interrupted pass resumes from its last completed checkpoint; other PRs keep independent counters.
- Preserve shared state: `loop_count`, `completed_round`, `started_at`, `deadline_at`, `last_full_pass_at`, `last_poll_at`, `watch_fingerprint`, `probe_snapshot`, `probe_count`, `consecutive_noops`, `dirty_after_pass`, `pending_wake_events`, `externally_blocked`, `last_watch_verification_at`, and `wake_reason`.
- Preserve every workflow-specific state field and `needs_user` source/version/next-action field. Never reset repair caps, de-duplication, workspace ownership, automerge ownership, or readiness evidence during a handoff.
- Checkpoint immediately after ownership-changing writes, pushes, or workspace allocation, not only at pass end. Only the relevant owner performs cleanup; retain durable PR memory after every exit.

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
- Never interrupt an active pass. Record relevant incoming events and source/head versions, let the owner finish safely, then reconcile against its returned snapshot. Collapse only unconsumed events into one follow-up.
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
- Interrupt another owner's work or destroy dirty/unpushed state during cleanup.

Stop and ask when workflow selection, scope, ownership, or a required permission is ambiguous; preserve state and leave existing PRs untouched.
An in-run decision parks its PR under the selected workflow's rules instead of silently ending a watch.

## Verification

Before reporting completion, quote actual check/probe output, not an expected result.
Record the selected workflow, clock owner, goal, first/last pass times, head/base snapshot, pass/probe counts, and exit reason.
Show one owner per PR, preserved handoff counters, final verification type/result, and cleanup owed or completed.
For babysit readiness, report every gate's fresh evidence; for review, report posted versus proposed artifacts under its existing rules.
No instruction-only check proves runtime enforcement, live bot compatibility, or atomic merge safety.
