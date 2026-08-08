#!/usr/bin/env bash
################################################################################
# --- Git Helpers ---
################################################################################

# list source repo names for a GitHub user (default: synle)
function repos() {
  if is_help_arg "${1:-}"; then
    echo "repos: list source repo names for a GitHub user
  Usage: repos [owner]
  Examples:
    repos
    repos synle
    repos facebook"
    return 1
  fi

  local owner="${1:-${BASHRC_GH_OWNER:-synle}}"
  gh repo list "$owner" --limit 100 --source --json name -q '.[].name'
}

# Opens the GitHub repo page for the current git remote in the browser
function repo() {
  if is_help_arg "${1:-}"; then
    echo "repo: open the GitHub repo page for the current git remote
  Usage: repo
  Examples:
    repo"
    return 1
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    echo "Error: no git remote found"
    return 1
  fi
  # Normalize to https URL (handles git@, ssh://, and https:// remotes)
  remote_url=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  echo "$remote_url"
  open "$remote_url"
}

# Opens the PR for the current branch in the browser (alternative: gh pr view --web)
function pr() {
  if is_help_arg "${1:-}"; then
    echo "pr: open the pull request for the current branch
  Usage: pr
  Examples:
    pr"
    return 1
  fi

  if type -P gh &> /dev/null; then
    gh pr view --web
    return
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    echo "Error: no git remote found"
    return 1
  fi
  remote_url=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  local branch
  branch=$(git branch --show-current)
  local pr_url="$remote_url/compare/$branch?expand=1"
  echo "$pr_url"
  open "$pr_url"
}

# Detects the default branch (main or master) from origin
function _get_default_branch() {
  local default_branch
  default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2> /dev/null | sed 's|refs/remotes/origin/||')
  if [ -z "$default_branch" ]; then
    for b in main master; do
      if git rev-parse --verify "origin/$b" > /dev/null 2>&1; then
        default_branch="$b"
        break
      fi
    done
  fi

  if [ -z "$default_branch" ]; then
    echo "Error: could not determine default branch from origin" >&2
    return 1
  fi

  echo "$default_branch"
}

# purge [-r] <path> - Remove a file from entire git history, then gc
function purge() {
  local recursive=""
  if [ "$1" = "-r" ]; then
    recursive="-r"
    shift
  fi

  local file_path="$1"
  if [ -z "$file_path" ] || is_help_arg "$file_path"; then
    echo "purge: remove a file or directory from entire git history
  Usage: purge [-r] <path-to-file-or-dir>
  Rewrites commits via git filter-branch (or filter-repo if available), then gc.
  Does NOT push — after purge, verify history then force-push manually."
    return 1
  fi

  if ! prompt_yes_no "Purge '$file_path' from entire git history?"; then
    echo ">> Aborted."
    return 1
  fi

  echo ">> Purging '$file_path' from git history..."

  if type -P git-filter-repo &> /dev/null; then
    git filter-repo --path "$file_path" --invert-paths
  else
    git filter-branch --force \
      --index-filter "git rm $recursive --cached --ignore-unmatch $file_path" \
      --prune-empty \
      --tag-name-filter cat \
      -- --all
  fi

  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  echo ">> Purge complete. Verify with 'git log --oneline' then force-push if satisfied."
}

# Merges origin/main (or origin/master) into the current branch
function merge_origin_main_branch() {
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  git merge "origin/$default_branch"

  echo "# ---- Merged origin/$default_branch into $(git branch --show-current) ----"
  git lastd
}

# Rebases current branch onto origin/main (or origin/master)
function rebase_origin_main_branch() {
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  git rebase "origin/$default_branch"

  echo "# ---- Rebasing $(git branch --show-current) onto origin/$default_branch ----"
  git lastd
}

# _clean_log_step <message> - Progress logger for clean() with auto/counter
function _clean_log_step() {
  _CLEAN_STEP=$((_CLEAN_STEP + 1))
  echo "[Step $_CLEAN_STEP/$_CLEAN_TOTAL - $((_CLEAN_STEP * 100 / _CLEAN_TOTAL))% done, $((_CLEAN_TOTAL - _CLEAN_STEP)) left] $1"
}

# Safely resets the current branch to origin's default branch.
# Stashes ALL changes (staged + unstaged + untracked) first as a safety backup so nothing is lost
# (recover with `git stash list` / `git stash pop`). Does NOT delete untracked working-tree files.
# Also deletes stale local branches (squash-merged PRs), branches fully merged into the default
# branch, local tags that no longer exist on origin, and prunes and removes merged/gone worktrees.
function clean() {
  if is_help_arg "${1:-}"; then
    echo "clean: safely reset current branch to origin's default branch
  Usage: clean
  Notes:
    - Stashes ALL changes (staged + unstaged + untracked) first as a safety backup
    - Recover from stash with: git stash list  |  git stash pop
    - Does NOT delete untracked working-tree files
    - Also deletes stale local branches (squash-merged PRs), merged branches, stale local tags, and prunes and removes merged/gone worktrees"
    return 1
  fi

  local total_steps=13
  _CLEAN_TOTAL=$total_steps
  _CLEAN_STEP=0

  # Safe stash first: capture staged + unstaged + untracked so nothing is lost.
  # If working tree is already clean (or an in-progress op blocks stash), this is a no-op.
  local stash_msg
  stash_msg="clean backup $(command date +%Y-%m-%d_%H:%M:%S)"
  _clean_log_step "Stashing all changes (staged + unstaged + untracked) as: '$stash_msg' ..."
  git stash push --include-untracked --message "$stash_msg" > /dev/null 2>&1
  echo "  -> recover with: git stash list  |  git stash pop"

  # Soft abort: cancel in-progress merge/rebase/cherry-pick/am WITHOUT 'git clean -fd',
  # so any untracked working-tree files that did not make it into the stash are preserved.
  _clean_log_step "Aborting any in-progress merge/rebase/cherry-pick/am (working tree preserved)..."
  command rm -rf .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2> /dev/null
  git merge --abort 2> /dev/null
  git rebase --abort 2> /dev/null
  git cherry-pick --abort 2> /dev/null
  git am --abort 2> /dev/null

  _clean_log_step "Fetching latest from origin..."
  git clean-and-fetch

  _clean_log_step "Garbage-collecting (only if last gc was >14d ago)..."
  git gc-if-stale

  _clean_log_step "Resolving default branch..."
  local default_branch
  default_branch=$(_get_default_branch) || return 1
  echo "  -> default branch: $default_branch"

  local current_branch
  current_branch=$(git branch --show-current)
  echo "  -> current branch: $current_branch"

  # Back up current branch to a temp branch
  local temp_branch="temp/$(command date +%Y%m%d-%H%M%S)"
  _clean_log_step "Backing up current branch to temp branch: $temp_branch ..."
  git checkout -b "$temp_branch" > /dev/null 2>&1

  _clean_log_step "Deleting local '$default_branch' (will be re-fetched from origin)..."
  git del "$default_branch" > /dev/null 2>&1

  _clean_log_step "Checking out '$default_branch'..."
  git checkout "$default_branch" > /dev/null 2>&1

  _clean_log_step "Rebasing '$default_branch' onto 'origin/$default_branch'..."
  git rebase "origin/$default_branch" > /dev/null 2>&1

  _clean_log_step "Cleaning up temp backup branch: $temp_branch ..."
  git del "$temp_branch" > /dev/null 2>&1

  _clean_log_step "Deleting stale local branches whose upstream is gone (squash-merged PRs)..."
  git clean-stale-branches

  _clean_log_step "Deleting merged local branches and tags pruned from origin..."
  git clean-merged-branches-and-tags

  _clean_log_step "Cleaning worktrees (prune + remove merged/gone worktrees)..."
  git clean-worktree

  echo "# ---- Reset to origin/$default_branch (100% done) ----"
  git lastd
}

# Creates an empty commit on a new branch and pushes it to trigger a deployment
function commit_empty_trigger_deploy() {
  local temp_branch_name="empty-commit-$(command date +%s)"
  git checkout -b "$temp_branch_name" > /dev/null 2>&1
  git commit --allow-empty -m "Trigger deployment - EMPTY PR" > /dev/null 2>&1
  git push -u origin "$temp_branch_name" > /dev/null 2>&1
}

# cd to git home directory ($MY_GIT_HOME or ~/git)
function gogit() {
  if is_help_arg "${1:-}"; then
    echo "gogit: cd to git home directory (MY_GIT_HOME or ~/git)
  Usage: gogit"
    return 0
  fi
  local git_home="${MY_GIT_HOME:-$HOME/git}"
  mkdir -p "$git_home" 2> /dev/null
  cd "$git_home"
}

# clone a repo by URL or owner/repo shorthand, tries SSH then falls back to HTTPS
function clone() {
  if [ -z "${1:-}" ] || is_help_arg "${1:-}"; then
    echo "clone: clone a repo by URL or owner/repo shorthand
  Usage: clone <url-or-owner/repo>
  Examples:
    clone git@github.com:synle/bashrc.git
    clone https://github.com/synle/bashrc.git
    clone synle/bashrc"
    return 1
  fi

  local input="$1"
  local clone_url=""

  if [[ "$input" =~ ^git@ ]] || [[ "$input" =~ ^https:// ]] || [[ "$input" =~ ^ssh:// ]]; then
    # Full SSH or HTTPS URL — use as-is
    clone_url="$input"
    if ! git ls-remote "$clone_url" &> /dev/null; then
      echo "clone: cannot access '$clone_url'"
      return 1
    fi
  elif [[ "$input" =~ ^[^/]+/[^/]+$ ]]; then
    # Short form: owner/repo — try SSH first, fall back to HTTPS
    local ssh_url="git@github.com:${input}.git"
    local https_url="https://github.com/${input}.git"
    if git ls-remote "$ssh_url" &> /dev/null; then
      clone_url="$ssh_url"
    elif git ls-remote "$https_url" &> /dev/null; then
      clone_url="$https_url"
      echo "clone: SSH access failed, falling back to HTTPS"
    else
      echo "clone: cannot access '$input' via SSH or HTTPS"
      return 1
    fi
  else
    echo "clone: invalid input '$input' — expected a URL or owner/repo"
    return 1
  fi

  git cl1 "$clone_url"
}

# cd to Downloads directory (tries multiple paths in order)
function godownload() {
  local candidates=(
    "$HOME/Downloads"
    "/mnt/d/Downloads"
  )
  # on WSL, try to resolve the Windows user Downloads folder via wslpath
  if type -P wslpath &> /dev/null; then
    local win_home
    win_home="$(wslpath "$(cmd.exe /C 'echo %USERPROFILE%' 2> /dev/null | tr -d '\r')" 2> /dev/null)"
    if [ -n "$win_home" ]; then
      candidates+=("$win_home/Downloads")
    fi
  fi
  local target
  target=$(find_path "${candidates[@]}" --folder) || {
    echo "godownload: no Downloads folder found"
    return 1
  }
  cd "$target"
}

################################################################################
# --- Git Worktrees ---
# Every worktree on this machine lives at exactly one kind of path:
#   $HOME/.worktrees/<owner>/<repo>/<repo>__<slot>
# The path is computed by the `git worktree-path` alias in git.gitconfig, and the
# folder is created by `git create-worktree`. Both are git aliases on purpose: a git
# alias resolves in ANY shell with no profile sourcing, so scripts, CI, and AI agents
# running `bash -c` land on the same folder as an interactive shell. This wrapper adds
# only the human conveniences on top - a copy-pasteable summary and a cd.
################################################################################

# git_create_worktree <branch> [<slot>] - Create or reuse the canonical worktree for a branch, then cd into it
function git_create_worktree() {
  if is_help_arg "${1:-}"; then
    echo "git_create_worktree: create or reuse the canonical worktree for a branch, then cd into it
  Usage: git_create_worktree <branch> [<slot>]
  Layout:
    \$HOME/.worktrees/<owner>/<repo>/<repo>__<slot>
  Notes:
    - <owner> and <repo> come from the origin remote, never from the folder name
    - <slot> defaults to branch-<branch>; every character outside [A-Za-z0-9._-] becomes '_'
    - pass a PR number as <slot> to get <repo>__pr-<number> instead
    - reuses a linked worktree already on <branch>, and never the primary checkout
    - falls back to a detached worktree when <branch> is checked out in the primary checkout
    - print the path without creating anything: git worktree-path <branch>
    - remove merged/gone worktrees later with: git clean-worktree"
    return 1
  fi

  if [ -z "${1:-}" ]; then
    echo "git_create_worktree: a branch name is required (see: git_create_worktree --help)"
    return 1
  fi

  local target
  target=$(git create-worktree "$1" "${2:-}") || return 1

  print_action_summary "$target"
  cd "$target"
}

################################################################################
# --- Git Patch Transfer ---
# Moving a commit between machines, in exactly two verbs:
#   git_patch_create  — last commit -> stdout + clipboard + temp file + shared folder
#   git_patch_apply   — patch file arg -> clipboard -> newest shared-folder patch
#
# Both sides funnel through one generator (_git_patch_write) and one applier
# (_git_patch_apply_file), so whatever `create` emitted is exactly what `apply`
# consumes no matter which transport carried it. The shared folder is optional
# everywhere: create says so and moves on, apply says so and gives up.
################################################################################

# _git_patch_temp_file: echo a patch path inside a fresh throwaway folder
function _git_patch_temp_file() {
  # A throwaway mktemp folder gives uniqueness for free — no timestamp, no
  # nested bookkeeping path, and the plain `mktemp -d` retry covers hosts
  # where /tmp is not writable (Termux) via the mktemp polyfill.
  local patch_folder
  patch_folder=$(mktemp -d "/tmp/patch-XXXXXX" 2> /dev/null || mktemp -d) || return 1
  echo "$patch_folder/${1:-patch.patch}"
}

# _git_patch_write: render the last N commits into a patch file (the only generator)
function _git_patch_write() {
  local patch_file="$1"
  # Rendered once into a file, then served to stdout / clipboard / upload from
  # there — a second `git patch-view` run could disagree with what was copied.
  git patch-view "${2:-1}" > "$patch_file" 2> /dev/null && [ -s "$patch_file" ]
}

# _git_patch_looks_like_patch: true when a file's head reads like a unified diff
function _git_patch_looks_like_patch() {
  local patch_file="$1"
  [ -s "$patch_file" ] || return 1
  # Repeated -e instead of an alternation: BRE `\|` is a GNU extension the BSD
  # grep on macOS does not owe us, and -E is off the table under an rg alias.
  command head -n 40 "$patch_file" | command grep -q -e "^diff --git " -e "^--- " -e "^From [0-9a-f]"
}

# _git_patch_clipboard_file: capture the clipboard into a temp patch file when it holds a diff
# Sets _GIT_PATCH_CLIPBOARD_FILE to the captured path on success. Returns non-zero and
# leaves nothing behind when the clipboard is empty, unreadable, or not a unified diff.
function _git_patch_clipboard_file() {
  _GIT_PATCH_CLIPBOARD_FILE=""

  local patch_file
  if ! patch_file=$(_git_patch_temp_file "clipboard.patch"); then
    echo ">>> could not create a temp folder for the clipboard patch" >&2
    return 1
  fi

  # `paste` with no args is raw by design — do NOT add --unwrap here, it
  # would trim the single-space blank context lines a unified diff needs.
  paste > "$patch_file" 2> /dev/null

  if ! _git_patch_looks_like_patch "$patch_file"; then
    command rm -f "$patch_file"
    return 1
  fi

  echo ">>> patch file created $patch_file"
  _GIT_PATCH_CLIPBOARD_FILE="$patch_file"
}

# _git_patch_apply_clipboard: apply the clipboard when it holds a diff
# Exit codes: 0 applied, 1 the patch failed to apply, 2 the clipboard holds no patch.
# The 2 is what lets each caller pick its own fallback — dropbox for git_patch_apply,
# cutting a fresh patch for `patch`.
function _git_patch_apply_clipboard() {
  _git_patch_clipboard_file || return 2

  echo ">>> applying patch from clipboard"
  _git_patch_apply_file "$_GIT_PATCH_CLIPBOARD_FILE"
}

# _git_patch_apply_file: the only applier — clean when it can, --reject when it must
function _git_patch_apply_file() {
  local patch_file="$1"

  # Dry-run first so a corrupt or already-applied patch is named as such before
  # anything touches the working tree.
  if git apply --check "$patch_file" 2> /dev/null; then
    git apply --whitespace=fix "$patch_file" || return 1
    echo ">>> patch applied cleanly $patch_file"
    return 0
  fi

  echo ">>> $patch_file does not apply cleanly — retrying with --reject" >&2
  git apply --reject --whitespace=fix "$patch_file" && {
    echo ">>> patch applied $patch_file"
    return 0
  }

  # --reject exits non-zero when any hunk was rejected, having still applied the
  # rest. Say that out loud: the tree is half-patched and .rej files are waiting.
  echo ">>> patch partially applied — resolve the .rej files, nothing was committed" >&2
  return 1
}

# _git_patch_upload: copy a patch into the shared dropbox folder when it is reachable
function _git_patch_upload() {
  local patch_file="$1"
  local repo_name="$2"

  local dropbox_folder
  if ! dropbox_folder=$(_dropbox_folder 2> /dev/null); then
    echo ">>> shared dropbox folder not reachable — skipped upload"
    return 0
  fi

  # Same repo-date prefix `git patch-rename` uses, plus the sha so two patches
  # cut in the same minute cannot collide.
  local target
  target="${dropbox_folder}/${repo_name}-$(command date +%Y_%m_%d_%H_%M)-$(git rev-parse --short HEAD 2> /dev/null).patch"
  if command cp "$patch_file" "$target" 2> /dev/null; then
    echo ">>> patch uploaded $target"
    # macOS writes ._ sidecars onto network shares; the reader skips them, but
    # they still clutter the folder for whoever opens it next.
    (type -P dot_clean &> /dev/null && dot_clean "$dropbox_folder" &> /dev/null) &
  else
    echo ">>> could not write $target — skipped upload" >&2
  fi
}

# _git_patch_apply_from_dropbox: apply the newest shared patch, then commit and archive it
function _git_patch_apply_from_dropbox() {
  local dropbox_folder
  if ! dropbox_folder=$(_dropbox_folder 2> /dev/null); then
    echo "git_patch_apply: shared dropbox folder not reachable — nothing to apply." >&2
    return 1
  fi
  local archive_folder="${dropbox_folder}/archived_patch"
  mkdir -p "$archive_folder"

  # Find the most recently modified non-empty .patch (cross-platform via node).
  # Heredoc read into a variable rather than nested in `$( ... )` — bash 3.2
  # tracks quotes through a nested heredoc body and an odd apostrophe count
  # there would break the parse of the whole profile.
  local find_patch_js latest_patch
  IFS= read -r -d '' find_patch_js << '_PATCH_FIND_EOF_' || true
    const fs=require('fs'),path=require('path'),dir=process.env._PATCH_ARG;
    const patches=fs.readdirSync(dir)
      .filter(f=>{
        if(!f.endsWith('.patch')||f.startsWith('._'))return false;
        const fp=path.join(dir,f),st=fs.statSync(fp);
        return st.isFile()&&st.size>0;
      })
      .map(f=>({p:path.join(dir,f),m:fs.statSync(path.join(dir,f)).mtimeMs}))
      .sort((a,b)=>b.m-a.m);
    if(patches.length)console.log(patches[0].p);
_PATCH_FIND_EOF_
  latest_patch=$(_PATCH_ARG="$dropbox_folder" node -e "$find_patch_js")

  if [ -z "$latest_patch" ]; then
    echo "git_patch_apply: no .patch files found in $dropbox_folder" >&2
    return 1
  fi

  # Decoded commit subject from the patch itself (handles RFC-2047 headers), so
  # the commit lands on this machine under the message it was authored with.
  local commit_msg
  commit_msg=$(git mailinfo /dev/null /dev/null < "$latest_patch" | command grep "^Subject: " | sed 's/^Subject: //')
  commit_msg="${commit_msg:-applied patch}"

  echo ">>> applying shared patch $latest_patch"
  echo ">>> commit message: $commit_msg"

  _git_patch_apply_file "$latest_patch" || return 1

  if ! (git add -A && git commit --allow-empty --no-verify -m "$commit_msg"); then
    echo "git_patch_apply: commit failed — patch was NOT archived." >&2
    return 1
  fi
  # --reset-author so the commit carries this machine's identity rather than the
  # sending machine's; --no-edit keeps it from stalling on an editor.
  git commit --amend --reset-author --no-edit --no-verify > /dev/null \
    || echo ">>> could not reset the commit author — commit kept as authored" >&2
  mv "$latest_patch" "$archive_folder"
  echo ">>> committed and archived to $archive_folder"
}

# git_patch_create: export the last commit as a patch — print, copy, save, upload
function git_patch_create() {
  if is_help_arg "${1:-}"; then
    echo "git_patch_create: export the last commit as a patch and hand it to every transport
  Usage: git_patch_create [count=1]
  Does all four, in order:
    1. prints the patch
    2. copies it to the clipboard ('copy --raw' — unwrap would corrupt the diff)
    3. saves it to a fresh /tmp/patch-<rand>/<repo>.patch
    4. uploads it to the shared dropbox folder, or says why it could not
  Examples:
    git_patch_create        last commit
    git_patch_create 3      last 3 commits
  Apply it on the other machine with: git_patch_apply"
    return 1
  fi

  local repo_root
  if ! repo_root=$(git rev-parse --show-toplevel 2> /dev/null); then
    echo "git_patch_create: not a git repository." >&2
    return 1
  fi

  local repo_name
  repo_name="$(basename "$repo_root")"

  local patch_file
  if ! patch_file=$(_git_patch_temp_file "${repo_name}.patch"); then
    echo "git_patch_create: could not create a temp folder." >&2
    return 1
  fi

  if ! _git_patch_write "$patch_file" "${1:-1}"; then
    echo "git_patch_create: could not generate a patch." >&2
    command rm -f "$patch_file"
    return 1
  fi

  # --raw is required: copy() otherwise pipes through unwrap(), which trims
  # blank context lines and joins wrapped-looking body lines, producing a
  # patch that git rejects with "corrupt patch at line N".
  copy --raw "$patch_file"

  command cat "$patch_file"

  echo ">>> patch copied to clipboard"
  echo ">>> patch file created $patch_file"
  _git_patch_upload "$patch_file" "$repo_name"
  print_action_summary "$patch_file" git_patch_apply
}

# git_patch_apply: apply a patch from a file, the clipboard, or the shared folder
function git_patch_apply() {
  if is_help_arg "${1:-}"; then
    echo "git_patch_apply: apply a patch from a file, the clipboard, or the shared dropbox folder
  Usage: git_patch_apply [patch_file]
  Resolution order:
    1. <patch_file>, when given
    2. the clipboard, when it holds something that reads like a patch
    3. the newest .patch in the shared dropbox folder — that source is also
       committed with the original message and archived once it applies
  Examples:
    git_patch_apply                  clipboard, else the newest shared patch
    git_patch_apply /tmp/fix.patch   apply an existing patch file
  Applies with --whitespace=fix, retrying with --reject when it will not apply cleanly."
    return 1
  fi

  local patch_file="${1:-}"

  if [ -n "$patch_file" ]; then
    if [ ! -f "$patch_file" ]; then
      echo "git_patch_apply: patch file '$patch_file' not found." >&2
      return 1
    fi
    _git_patch_apply_file "$patch_file"
    return $?
  fi

  local clipboard_status
  _git_patch_apply_clipboard
  clipboard_status=$?
  if [ "$clipboard_status" -ne 2 ]; then
    return "$clipboard_status"
  fi

  echo ">>> clipboard holds no patch — falling back to the shared dropbox folder"
  _git_patch_apply_from_dropbox
}

# Two verbs, both spellings — `<noun>_<verb>` and `<verb>_<noun>` land on the same
# function, so muscle memory never has to pick. `patch_get` is the producing side
# under git's own vocabulary (`git patch-get` renders the patch out of the repo).
alias patch_create='git_patch_create'
alias create_patch='git_patch_create'
alias patch_get='git_patch_create'
alias get_patch='git_patch_create'
alias patch_apply='git_patch_apply'
alias apply_patch='git_patch_apply'

# patch: one word for the whole transfer pair — apply when there is something to
# apply, otherwise cut a fresh patch. This shadows /usr/bin/patch in shells that
# load the profile; reach the binary with `command patch`.
function patch() {
  if is_help_arg "${1:-}"; then
    echo "patch: apply a patch when one is at hand, otherwise cut a new one
  Usage: patch [patch_file]
  Resolution order:
    1. <patch_file>, when given       -> git_patch_apply <patch_file>
    2. clipboard reads like a diff    -> apply the clipboard
    3. clipboard empty or not a diff  -> git_patch_create (export the last commit)
  Examples:
    patch                  apply the clipboard diff, else export the last commit
    patch /tmp/fix.patch   apply an existing patch file
  Shadows /usr/bin/patch — reach the binary with 'command patch'."
    return 1
  fi

  if [ -n "${1:-}" ]; then
    git_patch_apply "$@"
    return $?
  fi

  local clipboard_status
  _git_patch_apply_clipboard
  clipboard_status=$?
  if [ "$clipboard_status" -ne 2 ]; then
    return "$clipboard_status"
  fi

  echo ">>> clipboard holds no patch — creating one from the last commit instead"
  git_patch_create
}

################################################################################
# --- Pull Request Inventory ---
# One command for "what are my open PRs still waiting on", so an agent (or a
# human) does not fan six shell round-trips out by hand:
#   list_pending_prs           — text render, oldest PR first
#   list_pending_prs --json    — the same rows enriched, for a consumer to format
#
# Everything a PR needs comes back in ONE GraphQL call per PR — status checks,
# review decision, mergeability and review threads together — because the
# equivalent `gh pr view --json` + `gh api graphql` pair doubles the round trips
# for data GitHub hands over in a single query anyway.
################################################################################

# _list_pending_prs_repos: echo one owner/repo per line, from specs or discovery
function _list_pending_prs_repos() {
  local spec root
  {
    if [ "$#" -gt 0 ]; then
      for spec in "$@"; do
        # A local folder resolves through its remote; anything else is already a slug.
        # The folder name is never the repo name — ~/git/file-explorer can be acme/storage-ui.
        if [ -d "$spec" ]; then
          git -C "$spec" remote get-url origin 2> /dev/null
        else
          echo "$spec"
        fi
      done
    else
      # Ask git for the repo root rather than hunting for .git — that recognizes
      # worktrees and submodules whose .git is a file, never walks .git internals,
      # and `sort -u` collapses nested folders onto their owning repo.
      for spec in . */ */*/; do
        root=$(git -C "$spec" rev-parse --show-toplevel 2> /dev/null) || continue
        echo "$root"
      done | sort -u | while IFS= read -r root; do
        git -C "$root" remote get-url origin 2> /dev/null
      done
    fi
  } | sed -e 's#^ssh://[^/]*@github\.com/##' -e 's#^[^/]*@github\.com:##' \
    -e 's#^https://[^/]*github\.com/##' -e 's#\.git$##' \
    | command grep '^[^/][^/]*/[^/][^/]*$' | sort -u
}

# list_pending_prs: open PRs that still need something, oldest first
function list_pending_prs() {
  if is_help_arg "${1:-}"; then
    echo "list_pending_prs: list open PRs that still need something, oldest first
  Usage: list_pending_prs [--json] [--all] [--author=<handle>] [--limit=<n>] [repo ...]
  <repo> is 'owner/repo' or a local folder (resolved through its origin remote).
  With no repo argument, every git repo at or below the current folder — two
  levels deep — is discovered and used.
  Pending means open and NOT fully green; a PR drops off the list only once CI
  passes AND it is approved AND it has no conflict AND no open review threads.
  Options:
    --json             emit the enriched rows as JSON instead of the text render
    --all              keep the fully-green PRs too
    --author=<handle>  whose PRs to list (default: @me)
    --limit=<n>        search cap, 1-1000 (default: 1000)
  Examples:
    list_pending_prs
    list_pending_prs --json
    list_pending_prs acme/api acme/web
    list_pending_prs --all --author=alice
  A check whose name reads like a human approval gate counts as review, not CI —
  override the pattern with BASHRC_PR_GATE_CHECK_PATTERN."
    return 1
  fi

  if ! type -P gh &> /dev/null; then
    echo "list_pending_prs: gh is not installed." >&2
    return 1
  fi
  if ! type -P node &> /dev/null; then
    echo "list_pending_prs: node is not installed." >&2
    return 1
  fi

  local as_json=0 keep_ready=0 author="@me" limit=1000 arg
  local repo_specs
  repo_specs=()
  for arg in "$@"; do
    case "$arg" in
    --json) as_json=1 ;;
    --all) keep_ready=1 ;;
    --author=*) author="${arg#--author=}" ;;
    --limit=*) limit="${arg#--limit=}" ;;
    -*)
      echo "list_pending_prs: unknown option '$arg' — see list_pending_prs --help" >&2
      return 1
      ;;
    *) repo_specs+=("$arg") ;;
    esac
  done

  local repos
  if [ "${#repo_specs[@]}" -gt 0 ]; then
    repos=$(_list_pending_prs_repos "${repo_specs[@]}")
  else
    repos=$(_list_pending_prs_repos)
  fi

  if [ -z "$repos" ]; then
    echo "list_pending_prs: no GitHub repos resolved — pass 'owner/repo' arguments or run inside a checkout." >&2
    return 1
  fi

  local repo_flags line repo_count=0
  repo_flags=()
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      repo_flags+=(--repo "$line")
      repo_count=$((repo_count + 1))
    fi
  done << REPO_LIST_EOF
$repos
REPO_LIST_EOF

  local work
  work=$(mktemp -d "/tmp/pending-prs-XXXXXX" 2> /dev/null || mktemp -d) || return 1

  echo ">>> scanning $repo_count repo(s) for open $author PRs" >&2
  if ! gh search prs --author="$author" --state=open --limit "$limit" "${repo_flags[@]}" \
    --json number,repository,url > "$work/search.json" 2> "$work/search.err"; then
    command cat "$work/search.err" >&2
    command rm -rf "$work"
    return 1
  fi

  # Heredocs read into variables and kept at top level — bash 3.2 keeps counting
  # quotes through a heredoc nested inside $( ... ), so one apostrophe in a JS
  # comment there would corrupt the parse of everything after it.
  local pair_js
  IFS= read -r -d '' pair_js << 'PAIR_JS_EOF' || true
let raw = "";
process.stdin.on("data", function (d) { raw += d; });
process.stdin.on("end", function () {
  JSON.parse(raw).forEach(function (pr) {
    process.stdout.write(pr.repository.nameWithOwner + " " + pr.number + "\n");
  });
});
PAIR_JS_EOF

  node -e "$pair_js" < "$work/search.json" > "$work/pairs.txt" || {
    echo "list_pending_prs: could not read the search results." >&2
    command rm -rf "$work"
    return 1
  }

  local pr_count
  pr_count=$(command grep -c . "$work/pairs.txt" 2> /dev/null || true)
  pr_count=${pr_count:-0}
  if [ "$pr_count" -eq 0 ]; then
    echo ">>> no open $author PRs in those $repo_count repo(s)" >&2
    [ "$as_json" -eq 1 ] && echo "[]"
    command rm -rf "$work"
    return 0
  fi
  if [ "$pr_count" -ge "$limit" ]; then
    echo ">>> WARNING: hit the --limit of $limit — the result set is possibly truncated" >&2
  fi

  # mergeStateStatus, statusCheckRollup and reviewThreads in one query: gh pr view
  # cannot return reviewThreads at all, and gh search prs cannot return branch names,
  # so the three-call version is fetching one PR's state from three places.
  local query
  IFS= read -r -d '' query << 'GQL_EOF' || true
query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      url number title isDraft createdAt updatedAt mergeable mergeStateStatus
      headRefName baseRefName
      author{ login }
      repository{ nameWithOwner }
      reviewDecision
      reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ author{ login __typename } } } } }
      commits(last:1){ nodes{ commit{ statusCheckRollup{ state contexts(first:100){ nodes{
        __typename
        ... on CheckRun{ name status conclusion }
        ... on StatusContext{ context state }
      } } } } } }
    }
  }
}
GQL_EOF

  echo ">>> enriching $pr_count PR(s)" >&2
  # Subshell so an interactive shell does not print a job notification per fetch.
  (
    idx=0
    inflight=0
    while read -r slug number; do
      idx=$((idx + 1))
      gh api graphql -f owner="${slug%%/*}" -f repo="${slug##*/}" -F number="$number" \
        -f query="$query" > "$work/pr-$idx.json" 2> /dev/null &
      inflight=$((inflight + 1))
      if [ "$inflight" -ge 8 ]; then
        wait
        inflight=0
      fi
    done < "$work/pairs.txt"
    wait
  )

  local render_js
  IFS= read -r -d '' render_js << 'RENDER_JS_EOF' || true
const fs = require("fs");
const path = require("path");

const work = process.env._PENDING_PRS_WORK;
const asJson = process.env._PENDING_PRS_JSON === "1";
const keepReady = process.env._PENDING_PRS_ALL === "1";

// A human approval gate is reported as a check but never resolves on a timer, and
// a changes-resolution gate reports FAILURE while threads are open. Neither is a
// broken build, so both are read as review signal rather than CI.
const gateRe = new RegExp(
  process.env._PENDING_PRS_GATE_PATTERN
    || "approval|approve|reviewer|review required|sign-?off|codeowner|changes ?resolution|\\bcla\\b",
  "i",
);
const FAILED = ["FAILURE", "ERROR", "TIMED_OUT", "STARTUP_FAILURE"];
const UNFINISHED = ["QUEUED", "IN_PROGRESS", "WAITING", "PENDING", "REQUESTED", "EXPECTED"];

/**
 * Whole days since an ISO timestamp.
 * @param {string} iso ISO-8601 timestamp.
 * @returns {number} Age in whole days.
 */
function ageInDays(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * Flatten one GraphQL pull request into a scored, renderable row.
 * @param {object} pr The pullRequest node.
 * @returns {object} The enriched row.
 */
function shape(pr) {
  const commit = ((pr.commits || {}).nodes || [])[0] || {};
  const rollup = (commit.commit || {}).statusCheckRollup || {};
  const contexts = (rollup.contexts || {}).nodes || [];

  let failedCheck = "";
  let running = 0;
  let gates = 0;

  contexts.forEach(function (check) {
    const name = check.name || check.context || "check";
    const verdict = check.conclusion || check.state || "";
    const unfinished = UNFINISHED.indexOf(check.status || "") !== -1 || UNFINISHED.indexOf(verdict) !== -1;

    if (gateRe.test(name)) {
      if (unfinished || FAILED.indexOf(verdict) !== -1) gates += 1;
      return;
    }
    if (unfinished) {
      running += 1;
      return;
    }
    if (FAILED.indexOf(verdict) !== -1 && failedCheck === "") failedCheck = name;
  });

  let openHuman = 0;
  let openBot = 0;
  let resolved = 0;
  ((pr.reviewThreads || {}).nodes || []).forEach(function (thread) {
    if (thread.isResolved) {
      resolved += 1;
      return;
    }
    // Bot-ness comes from __typename, not a [bot] login suffix — review bots post
    // under plain-looking logins, so a suffix match reads a bot nit as a human blocker.
    const first = ((thread.comments || {}).nodes || [])[0] || {};
    if ((first.author || {}).__typename === "Bot") openBot += 1;
    else openHuman += 1;
  });
  const openThreads = openHuman + openBot;

  const decision = pr.reviewDecision || "";
  const conflicted = pr.mergeable === "CONFLICTING";
  const rawTitle = pr.title || "";
  const wip = /(^|[^a-z])(wip|do not merge)([^a-z]|$)/i.test(rawTitle);
  const draft = pr.isDraft === true;

  // Drop the [<repo>] title prefix — the URL on the same line already names the
  // repo, so keeping it prints the repo twice and buys nothing.
  const slug = (pr.repository || {}).nameWithOwner || "";
  const title = rawTitle.replace(/\[([^\]]+)\]\s*/g, function (match, inner) {
    return inner === slug.split("/").pop() ? "" : match;
  });

  const red = failedCheck !== "" || decision === "CHANGES_REQUESTED" || conflicted;
  const green = failedCheck === "" && running === 0 && decision === "APPROVED" && !conflicted;

  let group = "NEED APPROVAL";
  if (draft || wip) group = "NOT READY / WIP / DRAFT";
  else if (red) group = "NEEDS ATTENTION";
  else if (green) group = openThreads > 0 ? "READY TO MERGE (with comments)" : "READY TO MERGE";

  const ci = failedCheck !== ""
    ? "CI FAILED — " + failedCheck
    : running > 0
      ? "BUILD IN PROGRESS (" + running + " running)"
      : "CI PASSED";
  const review = decision === "APPROVED"
    ? "APPROVED"
    : decision === "CHANGES_REQUESTED"
      ? "CHANGES REQUESTED"
      : "AWAITING REVIEW";

  const status = [ci, review];
  if (conflicted) status.push("MERGE CONFLICT");
  if (openThreads > 0) {
    status.push(
      "\u{1F4AC} " + openThreads + " open"
        + (openBot > 0 ? " (" + openHuman + " human, " + openBot + " bot)" : ""),
    );
  }
  if (gates > 0) status.push("\u{23F3} " + gates + " approval gate" + (gates > 1 ? "s" : ""));
  if (pr.mergeStateStatus === "BEHIND") status.push("BEHIND " + (pr.baseRefName || "base"));

  return {
    url: pr.url,
    repo: (pr.repository || {}).nameWithOwner || "",
    number: pr.number,
    title: title,
    author: (pr.author || {}).login || "",
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    ageDays: ageInDays(pr.createdAt),
    headRefName: pr.headRefName || "",
    baseRefName: pr.baseRefName || "",
    isDraft: draft,
    isWip: wip,
    group: group,
    color: red ? "\u{1F534}" : green ? "\u{1F7E2}" : "\u{1F7E1}",
    ci: ci,
    review: review,
    failedCheck: failedCheck,
    runningChecks: running,
    approvalGates: gates,
    mergeable: pr.mergeable || "",
    mergeStateStatus: pr.mergeStateStatus || "",
    openThreads: openThreads,
    openHumanThreads: openHuman,
    openBotThreads: openBot,
    resolvedThreads: resolved,
    status: status.join(" \u{00B7} "),
  };
}

let unreadable = 0;
let rows = fs
  .readdirSync(work)
  .filter(function (name) { return name.indexOf("pr-") === 0 && /\.json$/.test(name); })
  .map(function (name) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(work, name), "utf-8"));
      return ((raw.data || {}).repository || {}).pullRequest || null;
    } catch (err) {
      return null;
    }
  })
  .filter(function (pr) {
    if (pr) return true;
    unreadable += 1;
    return false;
  })
  .map(shape);

const scanned = rows.length;
if (!keepReady) rows = rows.filter(function (row) { return row.group !== "READY TO MERGE"; });
// Oldest first: the PR nobody has touched longest is the one about to be forgotten.
rows.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0; });

if (asJson) {
  process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
} else {
  rows.forEach(function (row) {
    // No [WIP] tag: `wip` is only ever detected FROM the title, so printing it back
    // is pure duplication. [Draft] stays — draft state has no textual marker.
    const tags = row.isDraft ? "[Draft] " : "";
    process.stdout.write(
      [
        row.url,
        row.createdAt.replace("T", " ").replace("Z", "").slice(0, 16) + " (" + row.ageDays + "d)",
        row.color + " " + row.status,
        tags + row.title,
      ].join(" \u{00B7} ") + "\n",
    );
  });
}

process.stderr.write(
  ">>> " + scanned + " open \u{00B7} " + rows.length + (keepReady ? " listed" : " pending")
    + " \u{00B7} oldest first"
    + (unreadable > 0 ? " \u{00B7} " + unreadable + " PR(s) could not be fetched" : "")
    + "\n",
);
RENDER_JS_EOF

  _PENDING_PRS_WORK="$work" \
    _PENDING_PRS_JSON="$as_json" \
    _PENDING_PRS_ALL="$keep_ready" \
    _PENDING_PRS_GATE_PATTERN="${BASHRC_PR_GATE_CHECK_PATTERN:-}" \
    node -e "$render_js"
  local render_status=$?

  command rm -rf "$work"
  return $render_status
}

alias pending_prs='list_pending_prs'
alias prs_pending='list_pending_prs'
