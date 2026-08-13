[Sy] Create a pull request for the current branch.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. Do not derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` and inspect the unique author list:
   - All authors are Sy (`git config --get user.email` + historical Sy emails) and/or known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`) → **solo+bots**.
   - Otherwise → **multi-human**, proceed with PR flow.
   - **On solo+bots, unless the user explicitly said "open a PR" / "create a PR" / "draft a PR" in this request:** announce `"Looks like a solo+bots repo (<N> author(s): <emails>) — pushing direct to <default> instead of opening a PR. Override with 'open a PR' if you want one."`, then push to default (`git push origin <default>`) and stop. Skip every step below. No release is triggered — cutting one stays a manual `/sy-release`.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. **Resolve the base branch — it is always the repo's default branch, never a sibling.**

   ```bash
   DEF=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
   DEF=${DEF:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)}
   ```

4a. **No-stack pre-flight — run this before anything is pushed.** `git log --oneline "origin/$DEF..HEAD"` must list **only this PR's own commits**. If it also lists commits belonging to a sibling branch or another open PR, this branch was cut from that sibling and creating the PR now would stack it.

    - **On a hit, stop and report** rather than opening a stacked PR: `"This branch was cut from <sibling> — <n> of its commits are in the diff, so opening a PR now would stack this on <sibling's PR>. Options: (a) re-cut from <default> and re-apply only this branch's work, or (b) fold both into one PR. Which?"`
    - **Never resolve it by pointing `--base` at the sibling.** That makes the diff read cleanly and creates exactly the stack this check exists to prevent.

4b. **Sibling-overlap pre-flight — the last moment de-overlapping is still free.** A stack is not the only way sibling PRs collide; two independent PRs editing the same file collide too, and the second one to merge pays for it. List this branch's files and compare against your other open PRs in this repo:

    ```bash
    git diff --name-only "origin/$DEF...HEAD" | sort > /tmp/pr-files-mine
    gh pr list --repo <owner>/<repo> --author @me --state open --json number,url,headRefName --limit 100
    # then per sibling PR <n>:
    gh api "repos/<owner>/<repo>/pulls/<n>/files" --paginate --jq '.[].filename' | sort
    ```

    Empty intersection is the goal and needs no report. On a hit, classify before alarming anyone:

    - **Regenerable** (lockfile, snapshot, generated artifact) → not a real overlap. Note it and move on; the sync resolver regenerates these rather than merging them.
    - **Append-only** (barrel, registry, config list, enum block) → low risk. Say which file, and confirm this branch appended at the **end** rather than in sorted position — a sorted insert puts both siblings on adjacent lines and turns a trivial merge into a conflict.
    - **Same source or test file, substantive** → report it now, while it is still cheap: `"<file> is also changed by <sibling PR link> — whoever merges second hits a conflict."` Offer the fix from the _Make slices disjoint with new files_ rule; for tests that is almost always "move this branch's tests into their own spec file rather than appending to the shared one".

    **This is advisory, not a gate.** Shipping both and resolving once is sometimes the right call — the point is that the decision gets made now, deliberately, instead of being discovered by whoever merges second.

4c. **Wave check — does this branch need something that has not landed yet?** Ask before writing the PR: does this work require a migration, schema column, API field, or config key that is still sitting in an open PR? If yes, this is a later wave under the _Hard dependencies phase into waves_ rule, and **it does not belong in `/sy-create-pr`** — a PR that cannot merge should not look mergeable. Two things change and neither is the base: **the base stays `$DEF`** (a hard dependency never justifies basing on the blocking PR — that is the stack Step 4a exists to prevent), and the PR is opened as a WIP instead, per `/sy-draft-pr` — `WIP: DO NOT MERGE — [<repo>] ...` with a `## Blocked on` section naming the blocking PRs. Say out loud that you routed it there and why. If nothing is blocking, skip this step and continue; most PRs are wave 1 without anyone having to call them that.

5. Run `git diff "origin/$DEF...HEAD"` to understand all changes included in the PR.

5a. **Check for the repo's PR template** — `git ls-files | grep -i pull_request_template`. See the _PR body follows the repo's template_ rule for precedence order and fill rules. No hit → default body in Step 6.

6. Generate a PR title and body based on the changes:
   - Title: `[<repo>] <concise description of the changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). Repo comes from Step 1's resolved `owner/repo`, keeping only the part after the `/`.
   - **Template found → the body is that template, filled in** (see the rule named above).
   - **No template → default body:** a `## Summary` section with bullet points and a `## Test plan` section.
     6a. Write the complete PR body to an explicit temporary Markdown file with the file-editing tool (for example, `/tmp/pr-body.md`) and review that file. Do not create it with a shell heredoc, shell variable, `echo`, `printf`, or command substitution; do not put body text in the shell command.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR with the file-backed body: `gh pr create --base "$DEF" --title "[<repo>] ..." --body-file /tmp/pr-body.md`. **`--base` is always passed explicitly and is always the default branch** — never another feature branch, never another open PR's head. Never use `--body` or interpolate body contents into this command.
9. Return the PR URL.
   9a. **Create the durable PR journal.** Resolve the head branch from the created PR, call `worktree_create --path-only <head-branch>`, and use that exact canonical path to create or append the sibling file `pr<number>-<sanitized-branch>.md` under `$HOME/.worktrees/<owner>/<repo>/`. Record the PR URL, branch, request summary, body-file result, and creation timestamp. This journal persists across runs; it is not the temporary body file.
10. **Automerge decision — classify the diff, then act without asking on a standalone prose-only PR.** Run `git diff <base>...HEAD` (already fetched in Step 5) and bucket it:
    - **Prose-only AND standalone** (every changed line is docs-file content, a comment, a docstring, or whitespace — see the Automerge is opt-in rule for the exact definition — _and_ the PR has no companion PR still open): run `gh pr merge <number> --squash --auto` immediately, then report `"Standalone prose-only diff (<n> files, docs/comments only) — automerge enabled; CI and any required approval still gate it."` Do not ask. Skip entirely if the title carries `WIP` / `DO NOT MERGE` or the PR is a draft.
    - **Companion check** (only needed when the diff is prose-only). The PR is **not** standalone if any of these hold: the branch carries a group prefix `<username>/<group-slug>/<feature>` (3+ segments) shared with another open PR — `gh pr list --repo <owner>/<repo> --state open --json number,url,title,headRefName --limit 100`, plus a best-effort cross-repo sweep `gh search prs --author @me --state open --json number,url,title,repository --limit 50 '<group-slug>'` (`gh search prs --json` has no `headRefName`, so this one matches on text); the title or body references another open PR (`.../pull/<n>`, "depends on", "part of", "stacked on", a shared plan slug); or the base branch is another open PR's head. If it is not standalone, **do not enable automerge** — report `"Prose-only but not standalone — <n> companion PR(s) open: <links>. Automerge deferred so docs don't land before the code; /sy-babysit-pr will enable it once they merge."`
    - **Other trivial categories** (tests-only / dependency-only / otherwise trivial): ask once — `"This PR looks like <category>. Want me to enable automerge (gh pr merge --squash --auto)? (yes/no, default no)"`. Run `gh pr merge <number> --squash --auto` only on an explicit "yes".
    - **Anything else**: do not pass `--auto`, do not ask.
    - If `gh` rejects `--auto` (repo has auto-merge disabled, or squash is not an allowed method), report the exact error once and move on — never fall back to an immediate `gh pr merge` without `--auto`, and never retry.
11. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- **Never open a stacked PR.** `--base` is always the repo's default branch, passed explicitly, never another feature branch or another open PR's head. A branch whose diff carries a sibling's commits is a stack in the making — stop and re-cut it (Step 4a); never retarget `--base` to make the diff look right. If the work cannot be split into pieces that each stand alone against the default branch, ship it as **one** PR: one larger standalone PR always beats two stacked ones. See the "Every PR branches off the default branch" and "Split by slice, never by layer" rules.
- **PR body always comes from a reviewed file.** Use the file-editing tool to create the body file, pass it with `--body-file`, capture the result, and delete it immediately after the request whether creation succeeds or fails. Never use inline `--body`, shell interpolation, or shell heredocs for Markdown bodies. Follow the shared temporary-file rule for every later comment, reply, review, or API payload.
- **Sibling PRs collide on files, not just on bases (Step 4b).** The no-stack pre-flight only catches a shared _ancestor_; two perfectly independent PRs editing the same file still conflict, and nothing about `--base` prevents it. Check the file lists against your other open PRs before pushing and design the overlap out — see the "Make slices disjoint with new files, not with discipline" rule for the techniques, of which the highest-yield is one new spec file per slice instead of every slice appending to a shared one. Advisory, never a blocker.
- **A blocked PR is a WIP, not a stack and not a normal PR (Step 4c).** When the branch needs a migration, column, or API field still sitting in an open PR, neither shortcut is available: basing it on the blocking PR is the stack Step 4a forbids, and opening it as a normal PR presents something unmergeable as ready. Route it to `/sy-draft-pr` with a `## Blocked on` section instead. See the _Hard dependencies phase into waves, never into a stack_ rule.
- **Squash merge only.** Every PR merges via `gh pr merge --squash`. Never use `--merge` (regular merge commit) or `--rebase`. One PR = one commit on the default branch.
- **Automerge is opt-in except on a standalone prose-only diff** (docs files / comments / docstrings / whitespace and nothing else, with no companion PR still open — see the Automerge is opt-in rule). Standalone prose-only: enable `--auto` yourself right after creating the PR, no question asked (Step 10). Prose-only but part of a set (shared branch group slug, an explicit reference to another open PR, or a stacked base): leave `--auto` off and say why — `/sy-babysit-pr` enables it once the companions land, so docs never merge ahead of the code. Tests-only / dependency-only / otherwise trivial: offer once, enable only on explicit "yes". Everything else: don't ask, don't enable. Never on a WIP / `DO NOT MERGE` / draft PR regardless of the diff.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
- If `gh` reports the repo's allowed merge methods don't include squash, stop and surface the misconfiguration — do not fall back to a merge commit.
- **Release is never automatic.** Releases are expensive, so nothing here or in the babysit flow triggers one after a merge. Once the PR lands, cutting a release stays a deliberate, manual `/sy-release` the user invokes.
