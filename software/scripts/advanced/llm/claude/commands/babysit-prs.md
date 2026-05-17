[Sy] Run `/sy-babysit-pr` on EVERY open PR. This command is a fan-out wrapper — it finds all your open PRs and delegates the full per-PR loop (sync, comments, local checks, CI monitor) to `/sy-babysit-pr` for each one.

## Steps

1. Run `gh search prs --author=@me --state=open --json number,title,repository,isDraft,url,headRefName,baseRefName` to find all open PRs.

2. **Announce:** Tell the user how many open PRs were found and list them (repo, PR number, title).

3. **For each PR, delegate to `/sy-babysit-pr <PR-URL>`.** That command owns the full per-PR behavior:
   - step 0: early-exit if already green + approved (skipped PRs cost nothing),
   - step 1: merge base + resolve conflicts (always sync first),
   - step 2: address comments from human (non-bot) users,
   - step 3: address ONLY trivial / minor bot comments (typos, one-line nits — never redesign),
   - step 4: add / update tests to cover gaps from steps 2 and 3,
   - step 5: pull current CI state and pre-emptively fix any visible failures (lint, type, test, etc.),
   - step 6: run local tests / format / type checks / build (language-agnostic), fix before pushing,
   - step 7: monitor CI every 60s, fix any failing check (any language), loop back to step 0 on failure.
     Do NOT duplicate any of that logic here — if the per-PR flow needs to change, edit `/sy-babysit-pr`.

4. **Periodic status snapshot:** At the end of every 60-second polling cycle (across all PRs), run `/sy-list-prs` to render the current readiness table. This is the single source of truth for status output — do not hand-roll a separate table. Between snapshots, keep log lines terse (one line per action).

5. Repeat — delegate, wait 60s, render `/sy-list-prs` — until all PRs are green + approved or the remaining issues require human intervention (flaky infra, missing secrets, approval-gated checks). Report those clearly.

6. **Final report:** one last `/sy-list-prs` render plus a short summary of which PRs were skipped (already green), which were processed, and which need human attention.

## Rules

- This command is a dispatcher. The per-PR loop lives in `/sy-babysit-pr` — do not re-implement it here.
- Poll `/sy-list-prs` every 60s; do not spam `gh` calls.
