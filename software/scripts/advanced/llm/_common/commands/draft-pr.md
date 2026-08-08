[Sy] Create a WIP pull request for the current branch. Not a GitHub draft — a regular PR with a WIP title prefix so CI runs.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. NEVER derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` — if every author is Sy + known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`), the repo is solo+bots:
   - All authors are Sy + known bots → **solo+bots**. Unless the user explicitly said "open a PR" / "draft a PR" / "create a PR" in this request, announce `"Looks like a solo+bots repo — pushing direct to <default> with a WIP commit message instead of opening a PR. Override with 'draft a PR' if you want one."`, prefix the latest commit message with `WIP: DO NOT MERGE — ` (amend if needed), push to default, and stop.
   - Otherwise → proceed with WIP PR flow.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.
4. **Resolve the base branch — it is always the repo's default branch, never a sibling.**

   ```bash
   DEF=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
   DEF=${DEF:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)}
   ```

4a. **No-stack pre-flight — run this before anything is pushed.** `git log --oneline "origin/$DEF..HEAD"` must list **only this PR's own commits**. If it also lists commits belonging to a sibling branch or another open PR, this branch was cut from that sibling and creating the PR now would stack it. Stop and report — `"This branch was cut from <sibling> — <n> of its commits are in the diff, so opening a PR now would stack this on <sibling's PR>. Options: (a) re-cut from <default> and re-apply only this branch's work, or (b) fold both into one PR. Which?"` — and never resolve it by pointing `--base` at the sibling. A WIP PR is not an excuse to stack: a stacked WIP is still unmergeable until its parent lands and still shows a polluted diff.

5. Run `git diff "origin/$DEF...HEAD"` to understand all changes included in the PR.

5a. **Check for the repo's PR template** — `git ls-files | grep -i pull_request_template`. See the _PR body follows the repo's template_ rule for precedence order and fill rules. No hit → default body in Step 6.

6. Generate a PR title and body based on the changes:
   - Title format: `WIP: DO NOT MERGE — [<repo>] <concise description of changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). The WIP prefix stays outermost so the stop signal reads first.
   - **Template found → the body is that template, filled in** (see the rule named above). This is a WIP, so unfinished sections say `TODO — still wiring up X` rather than being deleted or fabricated, and most checklist boxes correctly stay unticked.
   - **No template → default body:** a `## Summary` section with bullet points and a `## Test plan` section.
7. Push the branch if needed: `git push -u origin <branch>`
8. Create the PR (regular, NOT draft): `gh pr create --base "$DEF" --title "WIP: DO NOT MERGE — [<repo>] ..." --body "..."`. **`--base` is always passed explicitly and is always the default branch** — never another feature branch or another open PR's head.
9. Return the PR URL.
10. Ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- If yes: run `/sy-babysit-pr` with the new PR URL.
- If no: stop.

## Rules

- Always create as a **regular PR** (never `--draft`) so CI runs immediately.
- **Never open a stacked PR.** `--base` is always the repo's default branch, passed explicitly, never another feature branch or another open PR's head. A branch whose diff carries a sibling's commits is a stack in the making — stop and re-cut it (Step 4a); never retarget `--base` to make the diff look right. If the work cannot be split into pieces that each stand alone against the default branch, ship it as **one** PR. See the "Every PR branches off the default branch" and "Split by slice, never by layer" rules.
- Always use the title prefix `WIP: DO NOT MERGE —` followed by `[<repo>] ` and a concise description.
- **Never enable automerge on a WIP PR** — the `DO NOT MERGE` title is the human stop signal and `--auto` would defeat it. This outranks every automerge carve-out: a prose-only WIP diff still gets no `--auto` (see the Automerge is opt-in rule). Set it only if the user explicitly asks, and only after the WIP prefix is gone.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
