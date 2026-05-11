[Sy] Run `/sy-sync-and-groom-repo` on EVERY git repo in the current folder. This command is a fan-out wrapper — it discovers repos and delegates the full per-repo cleanup loop (fetch, prune, drop dead branches/worktrees, sync default, merge default into every other branch) to `/sy-sync-and-groom-repo` for each one.

## Steps

1. **Discover repos to process** — exactly one level, no recursion into subdirectories of repos:
   - If `$PWD` itself is a git repo (`git rev-parse --show-toplevel` succeeds), include it.
   - For each immediate child directory of `$PWD`, include it if it has a `.git/` directory (or a `.git` file pointing at a worktree).
   - **Do NOT recurse.** Submodules and nested checkouts inside a repo are deliberately ignored — they're owned by their parent repo's lifecycle.

   Reference shell discovery (for clarity, not literal copy-paste):

   ```bash
   repos=()
   [ -e ".git" ] && repos+=("$PWD")
   for d in */; do [ -e "$d/.git" ] && repos+=("$PWD/${d%/}"); done
   ```

2. **Announce:** Tell the user how many repos were found and list them (basename + branch + dirty/clean indicator). Use `git -C <path> branch --show-current` and `git -C <path> status --porcelain` for the per-repo summary line.

3. **For each repo, delegate to `/sy-sync-and-groom-repo <absolute-repo-path>`.** That command owns the full per-repo behavior:
   - resolve target + announce
   - auto-stash (only if dirty)
   - detect default branch
   - fetch --all --prune (with tag-pruning safety check)
   - prune stale worktree records
   - drop ": gone]" branches
   - checkout default + pull --rebase
   - merge default into every other branch (resolve conflicts as needed, push if upstream)
   - visit each additional worktree and apply the same merge
   - gc --auto, return to default branch, pop stash, final report.

   Do NOT duplicate any of that logic here — if the per-repo flow needs to change, edit `/sy-sync-and-groom-repo`.

4. **Run sequentially, not in parallel.** Each delegation may need to resolve merge conflicts that require human judgment; running them concurrently would interleave prompts and make the conflict-resolution context impossible to follow. One repo at a time.

5. **If a per-repo run fails or asks the user for help:** surface that clearly in the running log, but continue to the next repo. Do not abort the whole fan-out on a single repo's conflict — collect per-repo outcomes and report them together.

6. **Final report:** A short summary table covering every repo: repo name, branches deleted, worktrees pruned, branches synced (with vs. without conflicts), branches skipped, and any repo that needs human attention (unresolved conflict, push refused, dirty stash that wouldn't pop).

## Rules

- This command is a dispatcher. The per-repo loop lives in `/sy-sync-and-groom-repo` — do not re-implement it here.
- **One level of discovery only.** Never recurse into subdirectories of discovered repos. Submodules and nested checkouts stay alone.
- **Sequential execution.** Conflict resolution is human-in-the-loop; parallel runs would scramble the prompts.
- **Continue on per-repo failure.** A stuck repo doesn't stop the rest of the fan-out — collect outcomes, report at the end.
- Do not auto-set upstreams, do not force-push, do not delete worktree directories. All those constraints come from `/sy-sync-and-groom-repo` and are inherited by this wrapper.
