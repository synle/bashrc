---
name: check
description: Verify that every change made in the current session is still present, and restore any that went missing. Use after a merge, rebase, force-push, stash, amend, or a formatter/hook run that may have reverted work.
---

## Purpose

Verify session changes survived the operation and recover only missing hunks.

## Steps

### 1. Gather current state

Run these in parallel:

```bash
git status -sb                                  # uncommitted changes / merge conflicts / ahead-behind
git --no-pager log --oneline -10                # recent commits
git --no-pager diff                             # unstaged changes
git --no-pager diff --cached                    # staged changes
git --no-pager reflog -15                        # actual operations and prior tips
git stash list                                  # work a hook or skill may have parked
```

Use the reflog to identify the operation and pre-operation SHA; do not infer either from a changed status list.

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

Read each current file and compare expected hunks with the verified pre-operation version, including legitimate later edits.

### 4. Restore missing changes

If any changes were lost (reverted by a hook, overwritten by a merge, or dropped during rebase):

1. Report exactly what's missing and in which file.
2. Recover the known-good version rather than retyping it from memory:

   ```bash
    git --no-pager reflog -30                             # locate the known-good tip
   git --no-pager show <good-sha>:<path>                 # inspect the good version
   git stash list && git stash show -p stash@{0}         # if the work was stashed, not committed
    git fsck --no-reflogs --unreachable                   # last resort: locate unreachable objects
   ```

3. Reapply only missing hunks from verified content. Preserve all legitimate later changes; never restore a whole file over them.
4. Confirm the restore:

   ```bash
   make validate
   ```

### 5. Report results

Summarize with a checklist:

- For each file: name, status (intact / restored / conflict resolved)
- If everything is intact, confirm with a short "all changes verified"

## Safety

Never:

- `git checkout`, `git restore`, or `git reset` a whole file to undo a regression — that reverts legitimate later changes with it. Re-apply the missing hunks individually.
- discard, stash-drop, or overwrite uncommitted work found in the tree; it may be the user's, not yours
- resolve a merge conflict by taking one side wholesale
- force-push, amend a pushed commit, or rewrite history to "restore" something
- report a file as restored on the strength of the diff alone — re-read it

If it is unclear whether a change is missing or was intentionally reverted by the user, stop and ask.

## Verification

Before declaring success, confirm and report:

- every file from the session, each labelled intact / restored / conflict-resolved
- `make validate` run after any restore, with its result quoted, not paraphrased
- any change that could not be recovered, named explicitly rather than omitted
- anything left in a conflicted or partial state
