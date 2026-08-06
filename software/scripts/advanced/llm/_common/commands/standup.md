[Sy] Summarize what actually shipped over a period — merged PRs, commits, reviews, issues — across every repo at or below the current folder. Facts from git and `gh` only, never invented.

Argument: $ARGUMENTS (optional — a period like `today`, `yesterday`, `week`, `2w`, `month`, `since 2026-05-01`, or a date range. Add `all` to include every author, `slack` for a paste-ready message, or a repo name to scope to one. Default: `week`, your work only, terminal format.)

## When to use

- Standup, weekly sync, or a status update.
- A self-review, promo packet, or performance-cycle summary.
- Reconstructing what happened after time away.
- Handing off work: what landed, what is in flight, what is blocked.

## Hard rules

- **Every line traces to a commit, PR, issue, or review.** No inferring intent, no inflating a one-line config change into "improved system reliability", no reporting a WIP PR as shipped. (See the Epistemic Honesty rules.)
- **Merged ≠ shipped when the repo has a release step.** If merges land behind a release workflow, say "merged" and note whether it released. Reporting unreleased work as shipped is the most common way a standup misleads.
- **Never invent a PR number, issue number, or SHA.** Every reference comes from a `gh` or `git` response in this session, and every link is a full clickable path (see the PR-link rules).
- **Say what is missing.** Work done outside git — design docs, reviews on other teams' repos, incident response, mentoring, meetings — is invisible here. Flag the blind spot rather than implying the git log is the whole contribution.
- **Show authors when the list is not all yours.** If `all` was requested or a repo has mixed authorship, label the author on every row (see the PR-author rules).

## Steps

### 1. Resolve scope

**Period** — convert `$ARGUMENTS` to a concrete ISO date and state it explicitly ("since 2026-05-29"). `week` means the last 7 days, not the calendar week, unless the user says otherwise. Default when empty: 7 days.

**Repos** — discover them with git rather than a hand-rolled `find` (see the repo-discovery rules):

```bash
for d in . */ */*/; do git -C "$d" rev-parse --show-toplevel; done 2>/dev/null | sort -u
```

Resolve each root to its real `owner/repo` (see the Repo Identification rules) — never `basename $PWD`.

**Author** — `git config --get user.email`, falling back to `gh api user --jq .login`. Include both the git email and the GitHub login; they frequently differ, and matching on only one silently drops half the work.

### 2. Gather facts

Per repo, all cheap and parallelizable:

```bash
# merged PRs authored by you
gh pr list --repo <owner/repo> --state merged --author "@me" --limit 50 \
  --json number,title,url,mergedAt,additions,deletions,author \
  --search "merged:>=<since>"

# still open — the "in flight" section
gh pr list --repo <owner/repo> --state open --author "@me" --limit 50 \
  --json number,title,url,createdAt,isDraft,reviewDecision,mergeStateStatus,author

# reviews you gave — real work that never shows up in a commit log
gh search prs --repo <owner/repo> --reviewed-by "@me" --updated ">=<since>" \
  --limit 50 --json number,title,url,author

# issues closed
gh issue list --repo <owner/repo> --state closed --assignee "@me" --limit 50 \
  --json number,title,url,closedAt

# direct commits — solo repos often push straight to the default branch
git -C <path> log --author="<email>" --since="<since>" --oneline --no-merges
git -C <path> log --author="<email>" --since="<since>" --shortstat --format='%h %s'
```

Also worth checking, when the repo has them: releases cut in the period (`gh release list`), and whether the default branch is currently green (`gh run list --branch <default> --limit 1`).

**Session history is a legitimate supplement** when the harness exposes it — it recovers work that produced no commit (investigations, spikes, reviews). Label it as such; never merge it into the shipped list.

### 3. Group by outcome, not by repo

The reader cares what got done, not which directory it lived in. Group into:

- **Shipped** — merged (and released, if the repo has a release step).
- **In flight** — open PRs, each with its actual state: draft, awaiting review, changes requested, CI red, conflicts.
- **Reviewed** — PRs you reviewed for other people.
- **Investigated / no code** — spikes, triage, incidents. Only when there is real evidence.
- **Blocked** — anything stalled, with what it is waiting on.

Within each group, order by impact, not by timestamp. A one-line fix that unblocked a release outranks a large mechanical refactor, and reverse-chronological ordering buries it.

Collapse mechanical noise: fifteen dependency bumps are one line ("15 dependency bumps"), not fifteen.

### 4. Write it

One line per item: what changed and why it mattered, in plain language, followed by the full link. Not the PR title verbatim — a title is written for reviewers who have the diff open, and a standup reader does not.

- Good: `Fixed the token refresh race that logged users out mid-session — github.com/acme/widget-store/pull/413`
- Bad: `Merged PR #413: refactor(auth): update token refresh handler`

State the period and scope at the top. Keep the whole thing scannable — this is read in fifteen seconds, in a meeting.

**`slack` format:** short, plain text, no markdown tables, no headers deeper than bold labels, links inline. Three sections at most (Shipped / In flight / Blocked). Under ten lines total. Write it as a normal human message — the caveman persona never applies to anything other humans read.

**Self-review / promo format:** group by theme rather than by week, note scope and impact, and include reviews given, since review load is real work that is systematically undercounted.

### 5. Report honestly

End with the caveats:

- Period and scope actually queried (repos, authors, date).
- Repos scanned versus repos skipped, and why any were skipped (no remote, no access, not a git repo).
- **Merged but not released**, if the repo gates on a release step.
- **Blind spots** — work that leaves no git trace, and any repo you could not query.
- Nothing padded. A light period reported honestly is more useful than a padded one; the reader is making staffing and priority decisions from this.
