---
name: check
description: Verify that every change made in the current session is still present, and restore any that went missing. Use after a merge, rebase, force-push, stash, amend, or a formatter/hook run that may have reverted work.
---

Verify that all recent changes from this conversation are still present in the codebase. Use this after a merge, rebase, force-push, or when a linter/hook may have reverted work.

## Steps

### 1. Gather current state

Run these in parallel:

```bash
git status -sb                                  # uncommitted changes / merge conflicts / ahead-behind
git log --oneline -10                           # recent commits
git --no-pager diff                             # unstaged changes
git --no-pager diff --cached                    # staged changes
git reflog -15                                  # what actually happened (merge, rebase, reset, amend)
git stash list                                  # work a hook or skill may have parked
```

`git reflog` is the load-bearing one — it names the operation (`merge`, `rebase -i (finish)`, `reset --hard`, `commit (amend)`) that could have dropped work, and gives you the pre-operation SHA to diff against.

### 2. Check for merge conflicts

If `git status` shows unmerged paths (conflict markers like `UU`, `AA`, `DU`):

```bash
git --no-pager diff --name-only --diff-filter=U   # exact list of conflicted files
```

1. Read each conflicted file and resolve the conflict. Default to preserving this session's changes, but read both sides first — when the incoming side carries work this session never touched (an upstream fix, a hook-applied format, a rename you're unaware of), keep it or merge both. Blindly taking "ours" silently reverts other people's commits.
2. Stage the resolved files (`git add <file>`)
3. Report what was resolved, and name any hunk where you kept the incoming side over this session's

### 3. Verify each changed file

Build the list of files this session touched, then compare each against the pre-operation state from the reflog:

```bash
git --no-pager diff --stat <pre-op-sha>..HEAD           # everything that moved since the risky operation
git --no-pager log -p -1 -- <file>                      # last commit that touched one file
git --no-pager log --oneline -5 -- <file>               # did a later commit overwrite it?
```

For each file: read its current content and confirm the expected change is still present. A PostToolUse formatter hook is the most common silent reverter — `git log --oneline -5 -- <file>` shows whether a `chore: format` style commit landed on top.

### 4. Restore missing changes

If any changes were lost (reverted by a hook, overwritten by a merge, or dropped during rebase):

1. Report exactly what's missing and in which file.
2. Recover the known-good version rather than retyping it from memory:

   ```bash
   git reflog -30                                        # find the SHA from before the loss
   git --no-pager show <good-sha>:<path>                 # inspect the good version
   git checkout <good-sha> -- <path>                     # restore one whole file
   git stash list && git stash show -p stash@{0}         # if the work was stashed, not committed
   git fsck --lost-found                                 # last resort: dangling commits/blobs
   ```

3. If only part of the file regressed, re-apply the missing hunks with Edit instead of `git checkout` — a whole-file restore would revert legitimate later changes too.
4. Confirm the restore:

   ```bash
   make validate
   ```

### 5. Report results

Summarize with a checklist:

- For each file: name, status (intact / restored / conflict resolved)
- If everything is intact, confirm with a short "all changes verified"
