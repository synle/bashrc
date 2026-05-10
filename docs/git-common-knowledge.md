# Git Common Knowledge

A reference guide covering practical Git — the mental model, daily commands, the rebase/merge decision, recovery from broken states, and a substantial section on `git worktree`.

This is a working reference, not a textbook. Every section answers "what command do I run, when, and why" rather than reciting man pages.

---

## Table of Contents

- [The Mental Model](#the-mental-model)
- [One-Time Setup](#one-time-setup)
- [Daily Flow](#daily-flow)
- [Reading History](#reading-history)
- [Branching](#branching)
- [Rebase vs Merge — When to Use Which](#rebase-vs-merge--when-to-use-which)
- [Stash](#stash)
- [Undo / Restore — The Escalation Ladder](#undo--restore--the-escalation-ladder)
- [Conflicts](#conflicts)
- [Tags & Releases](#tags--releases)
- [Remotes](#remotes)
- [Worktree](#worktree)
- [Reflog — The Safety Net](#reflog--the-safety-net)
- [Submodules](#submodules)
- [Hooks](#hooks)
- [Performance](#performance)
- [Common Gotchas](#common-gotchas)
- [This Repo's Aliases — Cheatsheet](#this-repos-aliases--cheatsheet)

---

## The Mental Model

Git tracks four kinds of objects, all stored under `.git/objects/` and addressed by SHA-1 hash:

| Object | Holds                                                         |
| ------ | ------------------------------------------------------------- |
| blob   | File contents (no name, no metadata)                          |
| tree   | A directory: list of `(name, mode, blob-or-tree-hash)`        |
| commit | `(tree-hash, parent-commit-hash(es), author, committer, msg)` |
| tag    | Annotated tag: `(target-hash, tagger, msg)`                   |

A commit points to a tree (the snapshot) plus parent commits (history). Branches are not first-class objects — they are **refs**: text files under `.git/refs/heads/<name>` that contain a single commit hash.

`HEAD` is `.git/HEAD` — usually a symbolic ref pointing at a branch (`ref: refs/heads/main`), occasionally pointing directly at a commit (a "detached HEAD" state).

**The four areas:**

```
working tree   →  staged (index)  →  committed (.git/objects)  →  remote
   git add              git commit             git push
```

`git status` shows the diff between these areas. Most confusion comes from forgetting which area a command operates on.

---

## One-Time Setup

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

git config --global init.defaultBranch main
git config --global pull.rebase true        # always rebase on pull
git config --global rebase.autoStash true   # auto-stash on rebase
git config --global rebase.autoSquash true  # auto-reorder fixup!/squash!
git config --global rerere.enabled true     # remember conflict resolutions
git config --global merge.conflictstyle zdiff3  # show base + ours + theirs
git config --global diff.algorithm histogram    # better than default myers
```

Repo-local config: drop `--global` and run inside the repo. Stored in `.git/config`.

This repo's full config — including ~80 aliases — lives at `software/scripts/git.gitconfig` and gets installed by `bash run.sh --files=git.js`.

---

## Daily Flow

The boring, common case. Aliases shown in parentheses are from this repo's git config.

```bash
# 1. Sync with main before starting
git checkout main          # (git co main)
git pull --rebase          # (git p ; pull.rebase=true means rebase by default)

# 2. Branch off
git checkout -b feature/foo  # (git cob feature/foo)

# 3. Work, stage, commit
git add path/to/file         # (git a)
git add -p                   # interactive — pick hunks (git ap)
git status                   # (git s)
git diff                     # unstaged changes (git d)
git diff --staged            # staged changes (git ds)
git commit -m "feat: foo"    # (git cm "feat: foo")

# 4. Push
git push                     # push.autoSetupRemote=true sets upstream first time

# 5. Sync before pushing again (always)
git pull --rebase            # rebase your local commits on top of remote
git push
```

**Always `git pull --rebase` before `git push`.** Without it, you get an unnecessary merge commit every time someone else pushes between your fetch and your push.

---

## Reading History

```bash
git log                              # full history
git log --oneline --graph --all      # condensed, all branches, ASCII graph
git log -p path/to/file              # patches that touched a file
git log -G "regex"                   # commits whose diff matches regex
git log -S "string"                  # commits that added/removed string
git log --since="2 weeks ago"
git log --author="Sy"
git log main..HEAD                   # commits on current branch not on main
git log HEAD..origin/main            # commits on remote not yet local

git show <sha>                       # full commit (message + diff)
git show <sha> -- path               # just one file from that commit
git show <sha>:path/to/file          # the file as it was at that commit

git blame path                       # line-by-line authorship
git blame -L 42,80 path              # only lines 42-80
git blame -w -C -C path              # ignore whitespace, follow code moves

git diff <a>..<b>                    # diff between two refs (two-dot)
git diff <a>...<b>                   # diff from common ancestor (three-dot)

git reflog                           # local ref movement history (see "Reflog")
```

`git log --oneline --graph --decorate --all` is the canonical "show me the topology" command. This repo aliases it as `git ls`.

### Comparing branches

```bash
git diff main...feature              # what feature has done since branching
git log main..feature --oneline      # the commits feature added
git log feature..main --oneline      # what main has that feature is missing
```

---

## Branching

```bash
git branch                           # list local branches
git branch -a                        # include remotes (git ba)
git branch -vv                       # show upstream + last commit msg (git b)
git branch -D <name>                 # force-delete local branch (git del)
git branch --merged                  # branches fully merged into HEAD
git branch --no-merged               # branches with unmerged work

git checkout <branch>                # switch
git checkout -b <new>                # create + switch (git cob)
git checkout -                       # switch to previous branch (git cop)

git switch <branch>                  # newer alias for checkout (no detach risk)
git switch -c <new>                  # create + switch
```

### Where did I branch from? Where did I diverge?

```bash
git merge-base main HEAD             # common ancestor SHA
git log --oneline $(git merge-base main HEAD)..HEAD   # my divergent commits
```

### Cleanup

```bash
# Delete local branches whose remote was deleted (e.g. after squash-merge)
git branch -vv | grep ': gone\]' | awk '{print $1}' | xargs git branch -D
# This repo aliases it as `git gone`.
```

### Renaming a branch

```bash
git branch -m old new                # rename current or specified branch
git push origin -u new               # push new
git push origin --delete old         # delete old remote
```

---

## Rebase vs Merge — When to Use Which

The single most contentious git topic. The pragmatic answer:

| Situation                                  | Use                                     | Why                                            |
| ------------------------------------------ | --------------------------------------- | ---------------------------------------------- |
| Sync your feature branch with `main`       | **rebase**                              | Linear history, no spurious merge commits      |
| Pull from a branch you share with others   | **merge**                               | Rebasing shared history rewrites their commits |
| Integrate a long-lived feature into `main` | **merge** (--no-ff) or **squash-merge** | Preserves the merge point as a logical unit    |
| Clean up local commits before pushing      | **rebase -i**                           | Squash WIPs, fix messages, reorder             |
| `git pull` on your own branch              | **rebase**                              | (`pull.rebase = true` makes this the default)  |

**The golden rule:** never rebase commits that exist on a branch others have based work on. Rebasing rewrites history — every rebased commit gets a new SHA, and anyone who had the old SHAs as parents now has a forked timeline. You can't un-rewrite shared history without coordination.

### Interactive rebase — the workhorse

```bash
git rebase -i HEAD~5           # edit the last 5 commits (this repo: git rn 5)
git rebase -i origin/main      # rebase whole branch onto origin/main
git rebase -i --root           # edit from the very first commit (git r0)
```

In the editor:

```
pick   abc1234 first commit
reword def5678 typo in message
edit   ghi9012 stop here, amend, then continue
squash jkl3456 fold into previous, keep its message
fixup  mno7890 fold into previous, drop its message
drop   pqr1234 throw it away
```

After saving:

- `reword`: editor opens for the new message
- `edit`: rebase pauses; modify files, `git add`, `git commit --amend`, `git rebase --continue`
- `squash`: editor opens to merge messages
- Conflict: fix files, `git add`, `git rebase --continue` (or `git rebase --abort`)

Auto-fixup workflow:

```bash
git commit --fixup=<sha>       # creates "fixup! <orig msg>"
git rebase -i --autosquash <sha>~  # auto-reorders fixups under their target
# rebase.autoSquash=true makes --autosquash the default
```

### `git pull --rebase`

Equivalent to:

```bash
git fetch
git rebase origin/<current-branch>
```

When you run `git pull` with `pull.rebase = true`, this is what happens. Your local commits get replayed on top of whatever was newly fetched, instead of producing a merge commit.

### Squash-merge (the GitHub default many teams use)

The whole feature branch becomes a single commit on `main`. From the CLI:

```bash
git checkout main
git merge --squash feature
git commit -m "feat: full description"
git branch -D feature
```

GitHub's "Squash and merge" button does the same. After merging, your local feature branch's commits are _not_ in main's history — only the squashed commit is. `git branch -D` is needed because git won't see the branch as merged.

---

## Stash

Quick snapshot of uncommitted work, restorable later.

```bash
git stash                            # stash tracked changes
git stash -u                         # include untracked
git stash -a                         # include untracked + ignored
git stash push -m "wip: foo"         # named stash
git stash push path/to/file          # stash only one path

git stash list                       # show all stashes
git stash show -p stash@{1}          # diff of a specific stash

git stash pop                        # apply + remove most recent (git pop)
git stash pop stash@{2}              # specific entry
git stash apply                      # apply, keep stash entry
git stash drop stash@{1}             # delete a stash without applying
git stash clear                      # delete all stashes

git stash branch new-branch          # create branch from stash + apply + drop
```

Stash is a stack (newest at `stash@{0}`). Stashes survive across branch switches, are local-only (never pushed), and live in `.git/refs/stash` + reflog.

**Anti-pattern:** using stash as long-term storage. Stash is for "I need to switch branches for 5 minutes." For longer parking, make a WIP commit instead — easier to find later, and `git wip` (this repo) does it in one alias.

---

## Undo / Restore — The Escalation Ladder

Git has many ways to undo. They form an escalation ladder — pick the lowest rung that does the job.

| What you want                                | Command                                                      | Destructive?         |
| -------------------------------------------- | ------------------------------------------------------------ | -------------------- |
| Discard unstaged changes in a file           | `git restore <file>`                                         | yes (working tree)   |
| Discard ALL unstaged changes                 | `git restore .`                                              | yes (working tree)   |
| Unstage a file (keep changes)                | `git restore --staged <file>`                                | no                   |
| Reset staged + working to HEAD               | `git reset --hard`                                           | yes                  |
| Undo last commit, keep changes staged        | `git reset --soft HEAD~1`                                    | no                   |
| Undo last commit, keep changes unstaged      | `git reset --mixed HEAD~1` (default)                         | no                   |
| Undo last commit, discard changes            | `git reset --hard HEAD~1`                                    | yes                  |
| Amend the last commit's message              | `git commit --amend -m "new msg"`                            | rewrites SHA         |
| Add forgotten file to last commit            | `git add f && git commit --amend --no-edit`                  | rewrites SHA         |
| Revert a commit (new commit that undoes it)  | `git revert <sha>`                                           | no (safe for shared) |
| Drop merged commits from `main` (force-push) | `git reset --hard <good-sha> && git push --force-with-lease` | YES — coordinate     |

**Critical distinction — reset vs revert:**

- `reset` rewinds the branch pointer. The commits become unreachable (still in reflog for ~90 days). **Don't use on shared branches.**
- `revert` creates a _new_ commit whose diff is the inverse. History is preserved. **Safe for shared branches.**

### `restore` vs `checkout` vs `reset`

`restore` (newer) and `checkout` (older, still works) overlap heavily for files. Modern recommendation:

- File operations → `git restore`
- Branch operations → `git switch`
- Index operations → `git reset`

Old `git checkout <file>` still works and is what most muscle memory has.

### `--force-with-lease` vs `--force`

When force-pushing (only on your own branches!), prefer `--force-with-lease`. It refuses the push if the remote moved since your last fetch — protecting against clobbering someone else's commits if they pushed to your branch while you weren't looking.

```bash
git push --force-with-lease           # safer
git push --force                      # nuclear; avoid
```

---

## Conflicts

When git can't auto-merge, it leaves markers in the conflicting files:

```
<<<<<<< HEAD
your version (the branch you're on)
||||||| common ancestor             # only with merge.conflictstyle=zdiff3
the original common version
=======
their version (the branch being merged in)
>>>>>>> feature
```

The `||||||| common ancestor` block (zdiff3) is _immensely_ helpful — you can see what changed on each side relative to the original. Without it (default style), you only see the two final versions and have to guess the original.

Workflow:

```bash
git status                  # lists conflicted files
# edit files, remove markers, decide what stays
git add <file>              # mark resolved
git status                  # confirm no remaining conflicts
git rebase --continue       # or: git merge --continue, git cherry-pick --continue
```

Useful tools:

```bash
git checkout --theirs <file>          # take their version entirely (git theirs)
git checkout --ours <file>            # keep our version entirely (git ours)
git mergetool                         # GUI merge tool (vimdiff by default in this repo)
git diff --check                      # show conflict markers + whitespace errors

git rerere                            # "reuse recorded resolution"
                                       # records each conflict + resolution;
                                       # auto-resolves identical conflicts later
                                       # (rerere.enabled=true in this repo)

git rebase --abort                    # bail out, restore pre-rebase state
git merge --abort                     # bail out of merge
git cherry-pick --abort               # bail out of cherry-pick
```

If you're truly stuck mid-operation: `git abort` (this repo's alias) blasts away every in-progress operation and resets to HEAD.

---

## Tags & Releases

Tags are refs that point at a commit. Two kinds:

```bash
git tag v1.0                          # lightweight (just a name → SHA)
git tag -a v1.0 -m "Release 1.0"      # annotated (object with metadata; preferred)
git tag -s v1.0 -m "Release 1.0"      # signed annotated (GPG)

git tag                               # list
git tag -l "v1.*"                     # filter
git show v1.0                         # show the tag (annotated) or commit (lightweight)
git push origin v1.0                  # push one tag
git push --tags                       # push all annotated tags
git push --follow-tags                # push tags reachable from pushed commits

git tag -d v1.0                       # delete locally
git push origin --delete v1.0         # delete on remote (or: git pdel-tag v1.0)
```

Always use annotated tags for releases. They carry author, date, message, and (optionally) a signature — lightweight tags are just bookmarks.

---

## Remotes

```bash
git remote -v                          # list remotes (URL + push/fetch role)
git remote add origin <url>
git remote rename origin upstream
git remote remove origin
git remote set-url origin <new-url>

git fetch                              # fetch from origin
git fetch --all --prune                # fetch all remotes, drop deleted refs (git fap)
git fetch origin pull/123/head:pr-123  # fetch a GitHub PR as a local branch

git ls-remote origin                   # list refs on a remote without fetching
```

### `--prune` matters

Without `--prune`, deleted upstream branches stay forever in your `git branch -a` listing as `remotes/origin/dead-branch`. Set `fetch.prune = true` globally, or always run `git fap` (which is `fetch --all --prune` in this repo).

### HTTPS vs SSH

| URL form                            | Auth        | Use                                |
| ----------------------------------- | ----------- | ---------------------------------- |
| `https://github.com/owner/repo.git` | token (PAT) | CI, machines without SSH key setup |
| `git@github.com:owner/repo.git`     | SSH key     | Daily local work                   |

Switch with `git remote set-url`. To force everything HTTPS without changing each repo:

```bash
git config --global url."https://github.com/".insteadOf "git@github.com:"
```

---

## Worktree

`git worktree` is the most underused power tool in git. It lets a single repository have **multiple working directories checked out simultaneously, each at a different branch**, without cloning.

### Why care?

The classic problem: you're deep in a feature branch with uncommitted changes. A bug report comes in for `main`. Options without worktrees:

1. `git stash`, `git checkout main`, fix, commit, push, `git checkout feature`, `git stash pop`. Slow, error-prone, breaks IDE state, blows up file watchers.
2. `git clone` the repo again into a different folder. Works, but downloads everything again, doubles disk usage, and you have two `.git` directories to keep in sync.

Worktrees are option 3, and they're free: every worktree shares the same `.git/` (objects, refs, hooks). Only the working files are duplicated, and even those are typically small relative to history. Switching between worktrees is `cd`, not `git checkout`.

### How it actually works

A "main" worktree is the normal repo you cloned. Additional worktrees are directories that contain a small `.git` _file_ (not a directory) pointing back to the main repo's git directory:

```
~/git/myrepo/                  ← main worktree
├── .git/                      ← actual git directory
│   ├── worktrees/             ← per-additional-worktree state
│   │   ├── hotfix/            ← per-worktree HEAD, index, logs
│   │   └── pr-review/
│   └── ...
├── src/...
└── README.md

~/git/myrepo-hotfix/           ← additional worktree (hotfix branch)
├── .git                       ← FILE: "gitdir: /Users/.../myrepo/.git/worktrees/hotfix"
├── src/...
└── README.md
```

Each worktree has its own `HEAD`, index, and (working tree) files, but shares the object store. A commit you make in any worktree is _immediately_ visible to all the others — they're all looking at the same `.git/objects/`.

### Commands

```bash
# Create a new worktree at <path>, checked out to <branch>
git worktree add <path> <branch>

# Create a worktree on a NEW branch (-b creates the branch)
git worktree add -b hotfix-1234 ../myrepo-hotfix main

# Detached HEAD worktree (e.g. for code review of an arbitrary commit)
git worktree add --detach <path> <sha>

# List all worktrees
git worktree list

# Remove a worktree (cleans up the working dir + bookkeeping)
git worktree remove <path>

# Force-remove (worktree has uncommitted changes)
git worktree remove --force <path>

# Garbage-collect stale worktree records (after manual deletion of the dir)
git worktree prune
```

### The four canonical patterns

#### 1. Hotfix while feature is in flight

```bash
# You're at ~/git/myrepo on branch feature/auth, dirty tree.
git worktree add -b hotfix-prod ../myrepo-hotfix main
cd ../myrepo-hotfix
# fix, commit, push, open PR
cd ../myrepo
# back to your feature branch, exactly as you left it
```

When the hotfix is merged:

```bash
git worktree remove ../myrepo-hotfix
git branch -d hotfix-prod      # branch is merged, safe delete
```

#### 2. Code review without losing your place

```bash
git fetch origin pull/456/head:review-456
git worktree add --detach ../myrepo-review review-456
cd ../myrepo-review
# explore, run tests, leave it open while you keep working in main worktree
```

Detached HEAD here is intentional — you're not going to commit to this branch, just inspect it.

#### 3. Long-running build / test in the background

You want to run `make test_all` (slow) while continuing to develop. Without worktrees, your file edits during the test run change what the test sees. With:

```bash
git worktree add ../myrepo-ci HEAD     # snapshot of current branch
cd ../myrepo-ci && make test_all &
cd ../myrepo                            # keep developing; CI worktree is frozen
```

When the test finishes, results are in `../myrepo-ci/`. Remove when done.

This is also how Claude Code's `isolation: "worktree"` agent option works under the hood — it creates a temporary worktree so the agent's edits don't conflict with your working tree.

#### 4. Comparing two branches side by side

```bash
git worktree add ../myrepo-old release/v1
git worktree add ../myrepo-new release/v2
diff -ru ../myrepo-old/src ../myrepo-new/src
# or open both in your editor as separate windows
```

### Restrictions and gotchas

**You cannot check out the same branch in two worktrees.** Git enforces this — if `main` is checked out in `~/git/myrepo`, `git worktree add ../other main` errors. Workarounds:

- Use `--detach` to check out the same commit without owning the branch
- `git worktree add ../other main --force` (rarely the right answer)

**Hooks are shared.** All worktrees use `.git/hooks/`. A pre-commit hook in one worktree's commit will run on commits made from any worktree.

**`.git/info/exclude`, `.gitignore`, refs, and stashes are shared.** Stashes from any worktree go into the same stash list.

**Submodules are tricky.** Each worktree gets its own `.git/modules/<sub>/worktrees/<name>/`. Older git versions (< 2.25) had bugs here. If you can avoid submodules in worktree-heavy workflows, do.

**Don't `rm -rf` a worktree directory.** Use `git worktree remove`. If you do delete the directory directly, run `git worktree prune` to clean up the bookkeeping.

**Path naming convention.** Conventional sibling layout is `<repo>/` and `<repo>-<purpose>/`:

```
~/git/myrepo/           # main worktree
~/git/myrepo-hotfix/
~/git/myrepo-review-456/
~/git/myrepo-experiment/
```

Some teams prefer a `.worktrees/` subfolder inside the main worktree:

```
~/git/myrepo/
~/git/myrepo/.worktrees/hotfix/    # add ".worktrees" to .gitignore
```

Both work; pick one and stick with it.

### When NOT to use worktrees

- For most daily work — branches are lighter. Worktrees are for cases where you genuinely need _both_ states present simultaneously.
- For deeply nested IDE workspaces (some IDEs index slowly across multiple roots).
- When disk is tight on a huge repo with large working-tree files (objects are shared, but working files aren't).

---

## Reflog — The Safety Net

Every operation that changes a ref (`HEAD`, branches, etc.) is logged locally. The reflog is your "git undo" of last resort.

```bash
git reflog                         # all HEAD movements
git reflog show <branch>           # movements of a specific branch
git reflog --date=iso              # with timestamps
```

Output looks like:

```
abc1234 HEAD@{0}: rebase finished: returning to refs/heads/feature
def5678 HEAD@{1}: rebase: pick 'fix typo'
ghi9012 HEAD@{2}: checkout: moving from main to feature
jkl3456 HEAD@{3}: commit: feat: add foo
```

Each line shows `<sha> HEAD@{n}: <op>: <message>`. To recover:

```bash
git checkout HEAD@{3}              # go to that state (detached)
git reset --hard HEAD@{3}          # rewind current branch to that state
git branch recovered HEAD@{3}      # branch off that point
```

**Reflog entries last ~90 days** by default (`gc.reflogExpire`). After that, unreachable commits get garbage-collected. So in practice, anything you did in the past three months is recoverable.

Common recovery scenarios:

```bash
# "I just ran git reset --hard, lost my work"
git reflog                         # find the SHA before the reset
git reset --hard HEAD@{1}          # back to that state

# "I deleted a branch, want it back"
git reflog                         # find the branch's last commit
git checkout -b restored <sha>

# "I rebased and want to start over"
git reflog                         # find pre-rebase HEAD
git reset --hard HEAD@{n}
```

**Reflogs are local.** A clone has no reflog of its own — only entries from after the clone.

---

## Submodules

A submodule embeds another repo at a specific commit inside your repo. Useful for vendoring; painful in practice.

```bash
git submodule add <url> path/to/sub
git submodule update --init --recursive   # fetch on fresh clone
git submodule update --remote             # update to latest upstream

git clone --recurse-submodules <url>      # clone + init in one step
```

**Strong recommendation:** avoid submodules unless you have a specific reason. Common pitfalls:

- They store a _commit hash_, not a branch — easy to forget to update
- `git submodule update` overwrites local changes without warning
- CI must remember `--recurse-submodules`
- They're a frequent source of "works on my machine" failures

Alternatives: package managers (npm, pip, cargo), `git subtree` (vendors source into your repo), or just copy-pasting code with a comment about its origin.

---

## Hooks

Scripts under `.git/hooks/` that fire at certain points. The interesting ones:

| Hook         | Fires                                    | Common use                  |
| ------------ | ---------------------------------------- | --------------------------- |
| `pre-commit` | Before commit is finalized               | Lint, format, test          |
| `commit-msg` | After message edited, before commit done | Validate message format     |
| `pre-push`   | Before push                              | Run full test suite         |
| `post-merge` | After merge completes                    | Restart dev server, rebuild |

Hooks are not committed (`.git/` is local). Tools like [`husky`](https://typicode.github.io/husky/) (Node), [`pre-commit`](https://pre-commit.com/) (Python), or [`lefthook`](https://github.com/evilmartians/lefthook) install hooks from a config file checked into the repo.

To bypass: `git commit --no-verify` or `git push --no-verify`. Use sparingly — bypassed checks tend to ship broken code.

---

## Performance

Git is fast, but a few settings make it noticeably faster on large repos. This repo's `git.gitconfig` already has them:

```ini
[core]
    fsmonitor = true        # background daemon for status speed
    untrackedCache = true   # caches untracked file lookups
    commitGraph = true      # speeds log/history traversal
    preloadIndex = true     # multi-threaded index scanning

[feature]
    manyFiles = true        # bundle of perf features

[index]
    version = 4             # path compression

[checkout]
    workers = 0             # parallel file checkout (auto)

[fetch]
    writeCommitGraph = true # keeps commit-graph fresh on fetch

[maintenance]
    auto = true             # background gc/prefetch
    strategy = incremental
```

For huge repos: enable `git maintenance start` to run prefetch / commit-graph / loose-objects / pack-refs / incremental-repack on a schedule.

For _enormous_ repos (think Linux kernel): consider partial clones (`--filter=blob:none`) or sparse checkout (`git sparse-checkout`).

### Checking repo size

```bash
git count-objects -vH          # human-readable summary
du -sh .git                    # total .git size
git gc --aggressive            # aggressive repack (slow, run rarely)
```

---

## Common Gotchas

### Line endings

Set `core.autocrlf = input` (this repo's default) on macOS/Linux: convert CRLF→LF on commit, no conversion on checkout. On Windows, set `core.autocrlf = true`. Or — better — commit a `.gitattributes`:

```
* text=auto eol=lf
*.bat text eol=crlf
*.png binary
```

That makes line endings part of the repo, not a per-machine setting.

### Case-insensitive filesystems (macOS default, Windows)

Renaming `foo.js` → `Foo.js` is a no-op on the filesystem but git wants to track it. Use `git mv`:

```bash
git mv foo.js Foo.js
# or, for a stubborn case:
git mv foo.js foo.js.tmp && git mv foo.js.tmp Foo.js
```

Set `core.ignorecase = false` in `.git/config` to make git itself case-sensitive.

### Large files

Git stores full snapshots of every changed file in history forever. A 100 MB binary committed once will balloon every clone forever, even if you delete it later.

For binary blobs (images, PDFs, compiled assets, ML models): use **Git LFS** (`git lfs track "*.psd"`). LFS replaces the file with a pointer; the actual blob lives on a separate server.

If you've already committed huge files: `git filter-repo` (modern) or `git filter-branch` (deprecated, slow) can remove them from history. **This rewrites history** — coordinate with collaborators before doing it.

### Committed secrets

If you commit an API key:

1. **Rotate the secret immediately.** Assume it's compromised the moment you push.
2. Remove from history with `git filter-repo --path-glob='**/secrets.env' --invert-paths`.
3. Force-push (`--force-with-lease`) — coordinate with team.
4. Notify GitHub if it was on a public repo (they auto-detect many secret formats and notify, but rotate first).

A `pre-commit` hook with a tool like `gitleaks` or `detect-secrets` catches this before push.

### "Dubious ownership" on shared filesystems

Modern git refuses to operate on a repo whose `.git/` is owned by a different user (security feature, since 2.35.2):

```
fatal: detected dubious ownership in repository at '/path/to/repo'
```

Fix: `git config --global --add safe.directory /path/to/repo` (or `*` to disable the check globally — only on machines you trust).

### Detached HEAD

```
You are in 'detached HEAD' state...
```

This means `HEAD` points directly at a commit, not a branch. Commits made here are not on any branch — when you `checkout` away, they'll be unreachable (recoverable from reflog for ~90 days). To save them:

```bash
git switch -c new-branch          # creates branch at current HEAD
```

### Diverged with remote

```
Your branch and 'origin/main' have diverged
```

You both committed since the last sync. Choose:

- `git pull --rebase` — replay your commits on top of theirs (preferred)
- `git pull --no-rebase` — produce a merge commit
- `git reset --hard origin/main` — abandon your commits (destructive)

### `.gitignore` not ignoring a tracked file

Once a file is tracked, `.gitignore` doesn't apply to it. Untrack it first:

```bash
git rm --cached path/to/file        # untrack but keep on disk
echo "path/to/file" >> .gitignore
git commit -am "untrack file"
```

---

## This Repo's Aliases — Cheatsheet

The full list lives in `software/scripts/git.gitconfig`. Highlights:

```bash
# Status / staging
git s                    # status -sb + diff --stat -w
git stat                 # short status with branch info
git a / aa / ap / au     # add / add -A / add -p / add -u

# Commit
git c "msg"              # commit --no-verify
git cm "msg"             # commit --allow-empty --no-verify -m
git amend                # commit --amend
git wip                  # add all + commit "wip" (one-shot save)
git unwip                # undo wip if last commit was "wip"

# Branch
git b / ba               # list branches / list all incl. remote
git cob <name>           # checkout -b
git cop                  # checkout -  (previous branch)
git del <name>           # branch -D
git gone                 # delete branches whose remote is gone
git current              # current branch name
git root                 # repo root path

# Pull / push
git fap                  # fetch --all --prune
git fapr                 # reset fetch refspec, gc, fap, rebase
git p / po / pof         # pull / push origin / push origin --force
git pdel-branch <name>   # push origin --delete
git pdel-tag <tag>       # push origin --delete --tag
git track                # set upstream to origin/<current>

# Rebase
git r / rc / ri          # rebase / continue / interactive
git rn 5                 # rebase -i HEAD~5
git rn-code 5            # ditto, opens in VS Code
git rn-subl 5            # ditto, opens in Sublime
git r0                   # rebase -i --root

# Log / diff
git ls / lls             # pretty log (chronological / author-date order)
git l / ll               # ls/lls + --stat
git d / dh / ds          # diff / diff HEAD^ / diff --staged (word-diff -w)
git d1 / dh1 / ds1       # inline (no side-by-side) variants
git show1 <sha>          # show commit inline
git dhs                  # diff --stat HEAD~1
git stats                # shortlog -sn (commits per author)
git last / lastd         # last commit summary / + file stats

# Cherry-pick
git cp <sha> / cpc / cpn # cherry-pick / continue / no-commit

# Search
git search-logs "regex"  # find commits whose diff matches regex
git where-is <sha>       # which remote branches contain <sha>

# Patch
git patch-get N          # save last N commits as N .patch files
git patch-view N         # print last N commits patch to stdout
git patch-download N     # patch-get + rename with repo-date prefix

# Cleanup / recovery
git abort                # blast away every in-progress operation
git cleanfd              # abort + aggressive gc
git clean-and-fetch      # reset fetch refspec + gc + fap
git undo                 # reset HEAD~1 --mixed
```

Numbered convenience aliases also exist for common N values: `git r5`, `git r10`, `git patch-get5`, etc. (generated up to N=1000 in 50-step increments).

---

## Further Reading

The official docs are excellent and worth reading at least once:

- [Pro Git book](https://git-scm.com/book) — free, comprehensive
- `git help <command>` — opens the relevant man page (try `git help worktree`)
- `git help -a` — list all commands
- [Oh Shit, Git!?!](https://ohshitgit.com/) — practical recovery recipes

For visualizing, [git-sim](https://github.com/initialcommit-com/git-sim) renders branch operations as diagrams.

---

_Last updated: 2026._
