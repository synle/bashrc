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

# git_apply_patch: apply a patch file, or the clipboard when given no argument
function git_apply_patch() {
  if is_help_arg "${1:-}"; then
    echo "git_apply_patch: apply a patch file, or the clipboard when given no argument
  Usage: git_apply_patch [patch_file]
  Examples:
    git_apply_patch                     apply clipboard, saved under \${BASHRC_TEMP_ROOT_DIR}/patches
    git_apply_patch /tmp/fix.patch      apply an existing patch file"
    return 1
  fi

  local patch_file="$1"

  if [ -z "$patch_file" ]; then
    local patch_folder="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}/patches"
    if ! command mkdir -p "$patch_folder" 2> /dev/null; then
      echo "git_apply_patch: could not create '$patch_folder'." >&2
      return 1
    fi
    patch_file="$patch_folder/clipboard-$(date +%Y_%m_%d_%H_%M_%S).patch"

    # `paste` with no args is raw by design — do NOT add --unwrap here, it
    # would trim the single-space blank context lines a unified diff needs.
    paste > "$patch_file"
    echo ">>> patch file created $patch_file"
  elif [ ! -f "$patch_file" ]; then
    echo "git_apply_patch: patch file '$patch_file' not found." >&2
    return 1
  fi

  # Dry-run first so a corrupt or already-applied patch fails before it can
  # leave the working tree half-patched.
  if ! git apply --check "$patch_file"; then
    echo "git_apply_patch: '$patch_file' did not pass git apply --check — nothing applied." >&2
    return 1
  fi

  git apply "$patch_file" || return 1
  echo ">>> patch applied $patch_file"
}

# git_view_patch_latest_commit: print the last commit as a patch, copy it, and save it to a file
function git_view_patch_latest_commit() {
  if is_help_arg "${1:-}"; then
    echo "git_view_patch_latest_commit: print the last commit as a patch, copy it, and save it to a file
  Usage: git_view_patch_latest_commit
  Saves to \${BASHRC_TEMP_ROOT_DIR}/patches/<repo>-<timestamp>.patch and prints the path.
  Note: copies with 'copy --raw' — unwrap would corrupt the diff."
    return 1
  fi

  local repo_root
  if ! repo_root=$(git rev-parse --show-toplevel 2> /dev/null); then
    echo "git_view_patch_latest_commit: not a git repository." >&2
    return 1
  fi

  local patch_folder="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}/patches"
  if ! command mkdir -p "$patch_folder" 2> /dev/null; then
    echo "git_view_patch_latest_commit: could not create '$patch_folder'." >&2
    return 1
  fi

  local patch_file
  patch_file="$patch_folder/$(basename "$repo_root")-$(date +%Y_%m_%d_%H_%M_%S).patch"

  # Generate once into the file, then serve the clipboard and stdout from it —
  # a second `git patch-view` run would re-render and could disagree with what
  # was copied.
  if ! git patch-view > "$patch_file" || [ ! -s "$patch_file" ]; then
    echo "git_view_patch_latest_commit: could not generate a patch." >&2
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
  print_action_summary "$patch_file" git_apply_patch
}
