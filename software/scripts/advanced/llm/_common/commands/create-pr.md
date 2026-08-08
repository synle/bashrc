[Sy] Create a pull request for the current branch.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. Do not derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` and inspect the unique author list:
   - All authors are Sy (`git config --get user.email` + historical Sy emails) and/or known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`) → **solo+bots**.
   - Otherwise → **multi-human**, proceed with PR flow.
   - **On solo+bots, unless the user explicitly said "open a PR" / "create a PR" / "draft a PR" in this request:** announce `"Looks like a solo+bots repo (<N> author(s): <emails>) — pushing direct to <default> instead of opening a PR. Override with 'open a PR' if you want one."`, then push to default (`git push origin <default>`) and stop. Skip every step below; auto-release after push-to-default will fire on the next cycle.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. **Resolve the base branch — it is always the repo's default branch, never a sibling.**

   ```bash
   DEF=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
   DEF=${DEF:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)}
   ```

4a. **No-stack pre-flight — run this before anything is pushed.** `git log --oneline "origin/$DEF..HEAD"` must list **only this PR's own commits**. If it also lists commits belonging to a sibling branch or another open PR, this branch was cut from that sibling and creating the PR now would stack it.

    - **On a hit, stop and report** rather than opening a stacked PR: `"This branch was cut from <sibling> — <n> of its commits are in the diff, so opening a PR now would stack this on <sibling's PR>. Options: (a) re-cut from <default> and re-apply only this branch's work, or (b) fold both into one PR. Which?"`
    - **Never resolve it by pointing `--base` at the sibling.** That makes the diff read cleanly and creates exactly the stack this check exists to prevent.

5. Run `git diff "origin/$DEF...HEAD"` to understand all changes included in the PR.

5a. **Check for the repo's PR template** — `git ls-files | grep -i pull_request_template`. See the _PR body follows the repo's template_ rule for precedence order and fill rules. No hit → default body in Step 6.

6. Generate a PR title and body based on the changes:
   - Title: `[<repo>] <concise description of the changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). Repo comes from Step 1's resolved `owner/repo`, keeping only the part after the `/`.
   - **Template found → the body is that template, filled in** (see the rule named above).
   - **No template → default body:** a `## Summary` section with bullet points and a `## Test plan` section.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR: `gh pr create --base "$DEF" --title "[<repo>] ..." --body "..."`. **`--base` is always passed explicitly and is always the default branch** — never another feature branch, never another open PR's head.
9. Return the PR URL.
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
- **Squash merge only.** Every PR merges via `gh pr merge --squash`. Never use `--merge` (regular merge commit) or `--rebase`. One PR = one commit on the default branch.
- **Automerge is opt-in except on a standalone prose-only diff** (docs files / comments / docstrings / whitespace and nothing else, with no companion PR still open — see the Automerge is opt-in rule). Standalone prose-only: enable `--auto` yourself right after creating the PR, no question asked (Step 10). Prose-only but part of a set (shared branch group slug, an explicit reference to another open PR, or a stacked base): leave `--auto` off and say why — `/sy-babysit-pr` enables it once the companions land, so docs never merge ahead of the code. Tests-only / dependency-only / otherwise trivial: offer once, enable only on explicit "yes". Everything else: don't ask, don't enable. Never on a WIP / `DO NOT MERGE` / draft PR regardless of the diff.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
- If `gh` reports the repo's allowed merge methods don't include squash, stop and surface the misconfiguration — do not fall back to a merge commit.
- **Post-merge release is automatic.** When the babysit flow runs against this PR (or the user runs `/sy-babysit-pr` later), it will invoke `/sy-release` immediately after the PR transitions to `MERGED`. Repos without a release workflow no-op cleanly. No separate user action needed.
