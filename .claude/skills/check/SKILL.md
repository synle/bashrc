---
name: check
description: Verify that all changes from this session are still present after a merge, rebase, or hook. Restores missing changes if needed.
---

Verify that all recent changes from this conversation are still present in the codebase. Use this after a merge, rebase, force-push, or when a linter/hook may have reverted work.

## Steps

### 1. Gather current state

Run these in parallel:

- `git status -sb` — check for uncommitted changes or merge conflicts
- `git log --oneline -10` — see recent commits
- `git diff` — see any unstaged changes

### 2. Check for merge conflicts

If `git status` shows unmerged paths (conflict markers like `UU`, `AA`, `DU`):

1. List all conflicted files
2. Read each conflicted file and resolve the conflict, keeping our changes
3. Stage the resolved files
4. Report what was resolved

### 3. Verify each changed file

For every file that was modified during this conversation:

1. Read the file's current content
2. Confirm the expected changes are still present
3. If a change is missing, check `git log --oneline -5 -- <file>` to see if a commit overwrote it

### 4. Restore missing changes

If any changes were lost (reverted by a hook, overwritten by a merge, or dropped during rebase):

1. Report exactly what's missing and in which file
2. Re-apply the missing changes using Edit
3. Run `make validate` to confirm the restored changes pass

### 5. Report results

Summarize with a checklist:

- For each file: name, status (intact / restored / conflict resolved)
- If everything is intact, confirm with a short "all changes verified"
