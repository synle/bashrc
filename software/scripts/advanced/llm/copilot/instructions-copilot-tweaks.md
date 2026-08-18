# Copilot CLI — harness-specific tweaks

Everything in this file is true of **GitHub Copilot CLI and nothing else**. It is deployed
only into `~/.copilot/instructions/`, never into the shared `~/sy_llm_ai/instructions/`
folder, precisely because the other harnesses must not inherit these limits: Claude Code,
Gemini CLI, and OpenCode read the same shared instructions and run the same `/sy-*` command
set, and none of them has the constraints below.

Anything that is true of every harness belongs in the shared instructions instead. A rule
that lands here is a rule the other three are deliberately being kept away from.

## Background job concurrency cap

- **This harness runs at most 8 background jobs at once.** That number is `S`, the harness concurrency cap, and **this bullet is the only place in the entire corpus where it is written down** — tuning concurrency is a one-line edit here, never a corpus-wide find-and-replace. Every command that fans work out across parallel background jobs — `/sy-babysit-prs`, `/sy-review-prs`, and any future fan-out — asks for "the harness concurrency cap" and resolves it from this line. Those commands are harness-agnostic by design and hardcode no number. Never copy the number into a command, a skill, a plan, or a prompt; reference the cap by name and let it resolve each time.
- **8 is an observed working value, not a number read back from the runtime.** Copilot CLI exposes no concurrency setting to raise or lower — `copilot help config` (v1.0.81-0) documents no job-concurrency key — so this is a documented convention rather than a knob, and there is nothing in `settings.json` to keep in sync with it. Treat it as the starting assumption that the next rule corrects.
- **A discovered cap beats this declared one.** If a parallel launch is partially rejected and only `k` jobs actually start, `k` is the real cap for that run: follow the owning command's cancel-and-re-deal rule, use `k`, and report that the discovered value superseded this one. `k == 0` is a launch failure, not a cap of zero. This is what makes a stale number here degrade safely instead of stranding work — and if a run repeatedly discovers a different `k`, update this line rather than working around it.
- **A cap named on the invocation wins over the default.** An explicit `cap=<positive-int>` token in a command's arguments, or the user naming a cap in prose, takes precedence. Reject anything that is not a positive integer — fall back to 8 and say so, because a non-positive cap makes the round-robin slot assignment a division by zero. Always say which value you used and where it came from.
- **Absent a declared cap there is no cap.** This whole section is a Copilot-specific narrowing of an otherwise unbounded fan-out. On a harness that declares no concurrency cap, a fan-out opens one job per target and the assignment machinery is a no-op — never treat 8 as a floor other harnesses must honor.
- **The cap constrains slots, never scope.** It changes how many jobs run at once and never which targets are serviced — the "assign, never queue" rule in the shared PR workflow instructions still governs, so more targets than slots means the extras are dealt across the running slots rather than dropped or deferred to a second wave. A fan-out that services 8 of 11 PRs has failed even if all 8 succeed.
