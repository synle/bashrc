[Sy] Create a WIP pull request for the current branch. Ordinary WIP mode uses a regular PR; placeholder-before-implementation mode uses a true GitHub draft with `Placeholder` in the title, returns the link, and lets coding start behind that draft.

## Steps

1. **Resolve the repo** via `git remote get-url origin` → authoritative `owner/repo`. NEVER derive from folder name.
2. **Solo+bots check.** Run `git log --format='%ae' -200 | sort -u` — if every author is Sy + known bots (`*[bot]@*`, `noreply@anthropic.com`, `noreply@opencode.ai`, `copilot@github.com`, `gemini-cli@google.com`), the repo is solo+bots:
   - All authors are Sy + known bots → **solo+bots**. Unless the user explicitly said "open a PR" / "draft a PR" / "create a PR" in this request, announce `"Looks like a solo+bots repo — pushing direct to <default> with a WIP commit message instead of opening a PR. Override with 'draft a PR' if you want one."`, prefix the latest commit message with `WIP: DO NOT MERGE — ` (amend if needed), push to default, and stop.
   - Otherwise → proceed with WIP PR flow.
3. Run `git status` to check for uncommitted changes and `git log` to understand the commits on this branch.

3a. **Decide whether this is placeholder mode or ordinary WIP mode.** Compare the branch to the default branch after Step 4 resolves it.

- `git rev-list --count "origin/$DEF..HEAD"` returns `0` **and** `git diff --quiet "origin/$DEF...HEAD"` succeeds → this branch has no commits and no diff yet. This is **placeholder mode**: create one empty commit so GitHub has something to open a PR from, then create a minimal DRAFT placeholder PR and return the link before implementation starts.
- Otherwise → this is ordinary WIP mode with real work already present; continue with the normal diff-driven title/body flow below.

4. **Resolve the base branch — it is always the repo's default branch, never a sibling.**

   ```bash
   DEF=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
   DEF=${DEF:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)}
   ```

4a. **No-stack pre-flight — run this before anything is pushed.** `git log --oneline "origin/$DEF..HEAD"` must list **only this PR's own commits**. If it also lists commits belonging to a sibling branch or another open PR, this branch was cut from that sibling and creating the PR now would stack it. Stop and report — `"This branch was cut from <sibling> — <n> of its commits are in the diff, so opening a PR now would stack this on <sibling's PR>. Options: (a) re-cut from <default> and re-apply only this branch's work, or (b) fold both into one PR. Which?"` — and never resolve it by pointing `--base` at the sibling. A WIP PR is not an excuse to stack: a stacked WIP is still unmergeable until its parent lands and still shows a polluted diff.

4b. **Sibling-overlap pre-flight.** A stack is not the only way sibling PRs collide — two independent PRs editing the same file collide too, and the second to merge pays for it. Compare this branch's files against your other open PRs in the repo: `git diff --name-only "origin/$DEF...HEAD"` versus `gh api "repos/<owner>/<repo>/pulls/<n>/files" --paginate --jq '.[].filename'` for each sibling from `gh pr list --author @me --state open`. Regenerable files (lockfiles, snapshots, generated artifacts) are not real overlaps; an append-only file (barrel, registry, config list) is low risk provided this branch appended at the **end** rather than in sorted position; a substantive overlap in the same source or test file gets reported now — `"<file> is also changed by <sibling PR link> — whoever merges second hits a conflict."` Offer the fix from the _Make slices disjoint with new files_ rule, which for tests is almost always "move this branch's tests into their own spec file". **Advisory, not a gate** — and worth more on a WIP than anywhere else, since a WIP is still cheap to reshape.

4c. **Wave check — is this PR blocked on another PR that has not landed?** A WIP is the vehicle for a later wave, so ask it here: does this branch need something that is still sitting in an open PR — a migration, a schema column, a new API field, a config key? If yes, this is a wave-N PR under the _Hard dependencies phase into waves_ rule, and three things follow. **The base is still `$DEF`** — a hard dependency is never a reason to base this branch on the blocking PR; that is the stack the rule forbids. **The body gets a `## Blocked on` section** (Step 7). **Any sequence number in the title is merge order, not creation order** — see the _A sequence number in a title is MERGE order_ rule: `<i>` is monotonic against the wave, so a wave-4 PR never numbers below a wave-3 one, and a graph change renumbers the whole set rather than leaving a stale position behind. **Opening this PR into an existing wave set is itself such a change** — place it by its dependencies rather than at the end, renumber whatever moved (including `<N>`), and update the `## Blocked on` sections and any review thread that now quotes a superseded position. **Its red CI is expected, not neglect** — this branch legitimately lacks the dependency, so say so rather than letting a reader or a babysit loop read the failure as something to fix. If the answer is no, skip this step; most WIPs are simply unfinished, not blocked.

5. **Placeholder mode only:** if Step 3a found no commits and no diff, create one empty commit now:

   ```bash
   git commit --allow-empty -m "WIP: DO NOT MERGE — Placeholder PR"
   ```

   Then continue. This command creates the minimum branch divergence needed for a placeholder PR; implementation starts only after the PR link is shared.

6. Run `git diff "origin/$DEF...HEAD"` to understand all changes included in the PR.

6a. **Check for the repo's PR template** — `git ls-files | grep -i pull_request_template`. See the _PR body follows the repo's template_ rule for precedence order and fill rules. No hit → default body in Step 7.

7. Generate a PR title and body based on the changes:
   - **Placeholder mode** (Step 3a) → keep it deliberately minimal:
     - Title: `WIP: DO NOT MERGE — [<repo>] Placeholder`
     - Template found → fill it minimally and honestly with placeholders such as `TODO — placeholder PR opened before implementation starts` and `-` where a section truly has nothing yet.
     - No template → default body:

       ```md
       ## Summary

       - Placeholder draft PR opened before implementation starts.
       - Real diff and details land in later pushes.

       ## Test plan

       -
       ```
   - **Ordinary WIP mode** → Title format: `WIP: DO NOT MERGE — [<repo>] <concise description of changes>` — bare repo name, org / owner dropped (`[widget-store] ...`, never `[acme/widget-store] ...`). The WIP prefix stays outermost so the stop signal reads first.
   - **Template found → the body is that template, filled in** (see the rule named above). This is a WIP, so unfinished sections say `TODO — still wiring up X` rather than being deleted or fabricated, and most checklist boxes correctly stay unticked.
   - **No template outside placeholder mode → default body:** a `## Summary` section with bullet points and a `## Test plan` section.
   - **Blocked on an earlier wave (Step 4c) → add a `## Blocked on` section**, template or not, listing every PR this one waits for as a full `https://github.com/<owner>/<repo>/pull/<n>` URL with a half-line saying what it provides (`— adds the nullable \`org_id\` column`). Close it with one line stating the consequence: `"CI stays red until these land; this branch does not contain them."`That section is doing three jobs at once — it tells a human why a red WIP is fine, it is the reference that marks this PR non-standalone so automerge stays deferred, and it is what a later pass re-reads to decide the PR can be promoted.
7a. Write the complete WIP body to an explicit temporary Markdown file with the file-editing tool (for example,`/tmp/pr-body.md`) and review that file. Do not create it with a shell heredoc, shell variable, `echo`, `printf`, or command substitution; do not put body text in the shell command.
8. Push the branch if needed: `git push -u origin <branch>`
9. Create the PR with the file-backed body.
   - **Placeholder mode** → `gh pr create --draft --base "$DEF" --title "WIP: DO NOT MERGE — [<repo>] Placeholder" --body-file /tmp/pr-body.md`
   - **Ordinary WIP mode** → `gh pr create --base "$DEF" --title "WIP: DO NOT MERGE — [<repo>] ..." --body-file /tmp/pr-body.md`
   - In both cases, **`--base` is always passed explicitly and is always the default branch** — never another feature branch or another open PR's head. Never use `--body` or interpolate body contents into this command.
10. Return the PR URL immediately, and say implementation starts after this link is shared.
    10a. **Seed owned-PR memory.** After GitHub returns the PR URL, use stable identity `<owner>/<repo>#<number>`. Under `<<LLM_ROOT_FOLDER>>/pr_babysits/`, find an existing file by that identity in its heading or full PR URL and by historical filename aliases; otherwise create `<repo-name>_<number>_<slug>.md`, resolving `<owner>/<repo>` and `<repo-name>` from GitHub, preserving repository-name punctuation, and deriving a short lowercase snake_case slug from the title after stripping status / repo prefixes. One same-kind match is reused without renaming; multiple matches create no new file, so report the conflict and use the newest verified snapshot until consolidation is approved. Record a short TLDR, PR URL, owner/repo identity, branch/head SHA, WIP creation result/time, current status, and empty `## Progress`, `## Open Items`, `## State`, and `## Final Snapshot` sections. This file persists across runs and becomes `/sy-babysit-pr`'s canonical memory; never create a worktree-adjacent journal.
11. **Placeholder mode follow-through:** once real implementation lands, push the code, run `gh pr ready <number>`, drop the `WIP` / `Placeholder` title markers, and rewrite the body so it matches the implemented diff before asking for review.
12. **Ordinary WIP mode only:** ask the user: "Do you want me to babysit this PR until CI passes? (yes/no)"

- Placeholder mode → stop after returning the link; later implementation promotes this same PR via Step 11.
- Ordinary WIP mode, yes → run `/sy-babysit-pr` with the new PR URL.
- Ordinary WIP mode, no → stop.

## Rules

- Ordinary WIP mode creates a **regular PR**; placeholder-before-implementation mode creates a **draft PR**.
- **Placeholder PRs before implementation are first-class use of this command.** On a fresh feature branch with no commits and no diff, make one empty placeholder commit, push it, open a draft PR whose title contains `Placeholder`, return the link, and only then start coding.
- **PR body always comes from a reviewed file.** Apply shared Payloads for creation and all later GitHub writes: reviewed file, file-backed request, captured result, immediate cleanup.
- **Never open a stacked PR.** `--base` is always the repo's default branch, passed explicitly, never another feature branch or another open PR's head. A branch whose diff carries a sibling's commits is a stack in the making — stop and re-cut it (Step 4a); never retarget `--base` to make the diff look right. If the work cannot be split into pieces that each stand alone against the default branch, ship it as **one** PR. See the "Every PR branches off the default branch" and "Split by slice, never by layer" rules.
- Always use the title prefix `WIP: DO NOT MERGE —` followed by `[<repo>] ` and a concise description. Placeholder mode additionally MUST include `Placeholder` in the title.
- **Sibling PRs collide on files, not just on bases (Step 4b).** The no-stack pre-flight only catches a shared _ancestor_; two perfectly independent PRs editing the same file still conflict. A WIP is the cheapest possible moment to fix that, since nothing has been reviewed yet and reshaping costs nothing — check the file lists against your other open PRs and design the overlap out per the "Make slices disjoint with new files, not with discipline" rule. Advisory, never a blocker.
- **Never enable automerge on a WIP PR** — the `DO NOT MERGE` title is the human stop signal and `--auto` would defeat it. This outranks every automerge carve-out: a prose-only WIP diff still gets no `--auto` (see the Automerge is opt-in rule). Set it only if the user explicitly asks, and only after the WIP prefix is gone.
- **A hard dependency is a wave, not a stack (Step 4c).** When this branch needs something still sitting in an open PR — a migration, a column, an API field — the answer is never to base it on that PR. It is cut from the default branch like every other PR, opened as this WIP, and simply not merged until the blocker lands; the `## Blocked on` section is what records the ordering, and its red CI is the expected cost rather than a defect. See the _Hard dependencies phase into waves, never into a stack_ rule for the promotion order and, for schema work, the expand → migrate → contract shape wave 1 has to take to be safe to land alone.
- **Skip PR creation entirely on solo+bots repos** — push direct to default unless the user explicitly asks for a PR.
