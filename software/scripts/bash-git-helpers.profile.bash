#!/usr/bin/env bash
################################################################################
# --- Git Helpers ---
################################################################################

# Refresh the current worktree's CodeGraph index through the guarded helper.
alias refresh_codegraph="codegraph_refresh"

# list source repo names for a GitHub user (default: synle)
function repos() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "repos: list source repo names for a GitHub user
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
    printf '%s\n' "repo: open the GitHub repo page for the current git remote
  Usage: repo
  Examples:
    repo"
    return 1
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    printf '%s\n' "Error: no git remote found"
    return 1
  fi
  # Normalize to https URL (handles git@, ssh://, and https:// remotes)
  remote_url=$(printf '%s\n' "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  printf '%s\n' "$remote_url"
  open "$remote_url"
}

# Resolve a PR reference to its canonical GitHub pull URL.
function _normalize_pr_url() {
  local input="${1:-}" repo_folder="${2:-}" pr_ref="" remote_url="" repo_slug="" number="" result=""

  case "$input" in
  https://github.com/*/pull/[0-9]*)
    printf '%s\n' "$input"
    return 0
    ;;
  */pull/[0-9]*)
    printf 'https://github.com/%s\n' "$input"
    return 0
    ;;
  esac

  if [ -d "$input" ]; then
    repo_folder="$input"
    pr_ref="${2:-}"
  elif [ -n "$repo_folder" ] && [ -d "$repo_folder" ]; then
    pr_ref="$input"
  elif [[ "$input" =~ ^([^/]+/[^/]+)/pull/([0-9]+)$ ]]; then
    printf 'https://github.com/%s\n' "$input"
    return 0
  elif [[ "$input" =~ ^([^/]+/[^/]+)#([0-9]+)$ ]]; then
    repo_slug="${BASH_REMATCH[1]}"
    number="${BASH_REMATCH[2]}"
    result=$(gh pr view "$number" --repo "$repo_slug" --json url --jq .url 2> /dev/null) || return 1
    printf '%s\n' "$result"
    return 0
  elif [[ "$input" =~ ^([^#]+)#([0-9]+)$ ]]; then
    repo_slug="${BASH_REMATCH[1]}"
    number="${BASH_REMATCH[2]}"
    result=$(gh api -X GET search/issues -f q="is:pr repo:$repo_slug number:$number" --jq '.items[0].html_url' 2> /dev/null) || return 1
    [ -n "$result" ] || return 1
    printf '%s\n' "$result"
    return 0
  else
    printf '%s\n' "pr: invalid reference '$input'" >&2
    return 1
  fi

  remote_url=$(git -C "$repo_folder" remote get-url origin 2> /dev/null) || return 1
  repo_slug=$(printf '%s\n' "$remote_url" | sed 's|ssh://[^@]*@github.com/||;s|git@github.com:|https://github.com/|;s|https://github.com/||;s|\.git$||')
  repo_slug=$(printf '%s\n' "$repo_slug" | sed 's|.*/\([^/]*\)/\([^/]*\)$|\1/\2|')
  case "$repo_slug" in
  */*) ;;
  *)
    printf '%s\n' "pr: could not resolve GitHub owner/repo from '$remote_url'" >&2
    return 1
    ;;
  esac

  [ -n "$pr_ref" ] || pr_ref=$(git -C "$repo_folder" branch --show-current 2> /dev/null)
  [ -n "$pr_ref" ] || {
    printf '%s\n' "pr: repository has no current branch" >&2
    return 1
  }
  gh pr view "$pr_ref" --repo "$repo_slug" --json url --jq .url 2> /dev/null
}

# Open the current branch PR, or normalize an explicit PR reference.
function pr() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "pr: open or normalize a pull request reference
  Usage: pr [url|owner/repo/pull/N|owner/repo#N|repo#N|repo-folder [N]]
  Examples:
    pr
    pr https://github.com/acme/api/pull/123
    pr acme/api#123
    pr api#123
    pr /work/api 123"
    return 1
  fi

  if [ -n "${1:-}" ]; then
    _normalize_pr_url "$@" || {
      printf '%s\n' "pr: could not resolve '$1' to a pull request" >&2
      return 1
    }
    return 0
  fi

  if type -P gh &> /dev/null; then
    gh pr view --web
    return
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    printf '%s\n' "Error: no git remote found"
    return 1
  fi
  remote_url=$(printf '%s\n' "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  local branch
  branch=$(git branch --show-current)
  local pr_url="$remote_url/compare/$branch?expand=1"
  printf '%s\n' "$pr_url"
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
    printf '%s\n' "Error: could not determine default branch from origin" >&2
    return 1
  fi

  printf '%s\n' "$default_branch"
}

# purge_branches_and_tags: delete local branches and tags except the default branch.
# Accepts only --dry-run or help; returns 1 on resolution, checkout, or deletion failure.
# Switches to the default branch without forcing; never resets or cleans working files.
# Unmerged branch tips and local-only tags lose their names; linked worktrees stay intact.
function purge_branches_and_tags() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "purge_branches_and_tags: delete local branches and tags except the default branch
  Usage: purge_branches_and_tags [--dry-run]
  Keeps origin's default branch, falling back to local main, then master.
  Switches to that branch without forcing checkout; it must exist locally.
  Deletes unmerged branches and all local tags. Remote refs stay intact.
  Never resets or cleans working files; normal checkout conflict protection applies.
  Branches checked out in linked worktrees cannot be deleted; failures return nonzero.
  Use --dry-run to preview without changing refs or switching branches."
    return 0
  fi
  local dry_run=0
  if [ "$#" -eq 1 ] && [ "$1" = "--dry-run" ]; then
    dry_run=1
  elif [ "$#" -ne 0 ]; then
    printf '%s\n' "purge_branches_and_tags: expected no arguments or --dry-run" >&2
    return 1
  fi

  command git rev-parse --show-toplevel > /dev/null || return 1
  local default_branch branch tags branches
  default_branch=$(_get_default_branch 2> /dev/null)
  if [ -z "$default_branch" ]; then
    for branch in main master; do
      if command git show-ref --verify --quiet "refs/heads/$branch"; then
        default_branch="$branch"
        break
      fi
    done
  fi
  if [ -z "$default_branch" ] || ! command git show-ref --verify --quiet "refs/heads/$default_branch"; then
    printf '%s\n' "purge_branches_and_tags: default branch must exist locally; nothing deleted" >&2
    return 1
  fi
  branches=$(command git for-each-ref --format='%(refname:strip=2)' refs/heads/) || return 1
  tags=$(command git for-each-ref --format='%(refname:strip=2)' refs/tags/) || return 1
  printf '%s\n' "-> keeping default branch '$default_branch'"
  if ((! dry_run)); then
    command git checkout "$default_branch" || return 1
  fi
  while IFS= read -r branch; do
    [ -n "$branch" ] && [ "$branch" != "$default_branch" ] || continue
    if ((dry_run)); then
      printf '%s\n' "-> would delete local branch '$branch'"
    else
      command git branch -D -- "$branch" || return 1
    fi
  done <<< "$branches"
  while IFS= read -r branch; do
    [ -n "$branch" ] || continue
    if ((dry_run)); then
      printf '%s\n' "-> would delete local tag '$branch'"
    else
      command git tag -d -- "$branch" || return 1
    fi
  done <<< "$tags"
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
    printf '%s\n' "purge: remove a file or directory from entire git history
  Usage: purge [-r] <path-to-file-or-dir>
  Rewrites commits via git filter-branch (or filter-repo if available), then gc.
  Does NOT push — after purge, verify history then force-push manually."
    return 1
  fi

  if ! prompt_yes_no "Purge '$file_path' from entire git history?"; then
    printf '%s\n' ">> Aborted."
    return 1
  fi

  printf '%s\n' ">> Purging '$file_path' from git history..."

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
  printf '%s\n' ">> Purge complete. Verify with 'git log --oneline' then force-push if satisfied."
}

# Merges origin/main (or origin/master) into the current branch
function merge_origin_main_branch() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "merge_origin_main_branch: merge origin/<default-branch> into the current branch
  Usage: merge_origin_main_branch
  Aborts any in-progress merge/rebase, fetches, then merges. Default branch is auto-detected."
    return 0
  fi
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  git merge "origin/$default_branch"

  printf '%s\n' "# ---- Merged origin/$default_branch into $(git branch --show-current) ----"
  git lastd
}

# Rebases current branch onto origin/main (or origin/master)
function rebase_origin_main_branch() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "rebase_origin_main_branch: rebase the current branch onto origin/<default-branch>
  Usage: rebase_origin_main_branch
  Aborts any in-progress merge/rebase, fetches, then rebases. Default branch is auto-detected."
    return 0
  fi
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  git rebase "origin/$default_branch"

  printf '%s\n' "# ---- Rebasing $(git branch --show-current) onto origin/$default_branch ----"
  git lastd
}

# echo_and_set_terminal_title <message...> - print a line to the scrollback AND
# set the terminal tab/window title to the same text, so a long-running step
# shows both inline and up top in the terminal title. set_terminal_title is a
# PATH command (installed by software/scripts/terminal-title.js); skip the title
# leg silently when it is not installed - the echo still lands.
function echo_and_set_terminal_title() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "echo_and_set_terminal_title: echo a message and set the terminal title to it
  Usage: echo_and_set_terminal_title <message...>
  Prints the message inline and mirrors it into the terminal tab/window title.
  The title leg is skipped when set_terminal_title is not on PATH."
    return 1
  fi

  printf '%s\n' "$*"
  if type -P set_terminal_title > /dev/null 2>&1; then
    set_terminal_title "$*"
  fi
}

# _log_progress_step <total_steps> <message> - reusable progress logger: bumps an
# internal counter (_PROGRESS_STEP, reset by the caller before the run), prints
# "Step N/total (P%) : message", and mirrors that same line into the
# terminal title via echo_and_set_terminal_title.
function _log_progress_step() {
  local total="$1"
  shift
  _PROGRESS_STEP=$((_PROGRESS_STEP + 1))
  echo_and_set_terminal_title "Step $_PROGRESS_STEP/$total ($((_PROGRESS_STEP * 100 / total))%) : $*"
}

# _clean_claude_worktrees <repo_root> - remove empty Claude worktree folders.
# A folder is eligible only when every child is an empty regular file or directory; symlinks
# and special files keep the folder in place. Prints unindented status and returns the final echo's status.
function _clean_claude_worktrees() {
  local repo_root="$1"
  local candidate
  local removed=0
  local unsafe
  local nonempty

  for candidate in "$repo_root"/.claude/worktree*; do
    [ -d "$candidate" ] || continue

    if command find "$candidate" -prune -mtime +90 -print 2> /dev/null | command grep -q .; then
      printf '%s\n' "-> warning: Claude worktree folder is older than 3 months; keeping $candidate"
      continue
    fi

    unsafe=$(command find "$candidate" \( -type l -o \( ! -type d ! -type f \) \) -print -quit 2> /dev/null)
    [ -z "$unsafe" ] || continue
    nonempty=$(command find "$candidate" -type f ! -size 0c -print -quit 2> /dev/null)
    [ -z "$nonempty" ] || continue

    command rm -rf "$candidate"
    removed=$((removed + 1))
    printf '%s\n' "-> removed empty Claude worktree folder $candidate"
  done

  if [ "$removed" -eq 0 ]; then
    printf '%s\n' "-> no empty Claude worktree folders found"
  else
    printf '%s\n' "-> removed $removed empty Claude worktree folder(s)"
  fi
}

# _clean_background_tail <total_steps> <repo_root> <force_worktrees> <default_branch> [include|skip]
# Run clean's slow follow-up work synchronously or as one backgrounded call, so interactive shells
# report a short job line instead of re-printing the whole subshell body when cleanup finishes.
# Keep unindented output live on stdout/stderr so progress lands line by line, not as a buffered dump.
# The optional worktree cleanup mode defaults to include; skip overrides force_worktrees.
# Removes cleanup files, stale branches/tags, and optionally Git worktrees; returns git lastd's status.
function _clean_background_tail() {
  local total_steps="$1"
  local repo_root="$2"
  local force_worktrees="$3"
  local default_branch="$4"
  local worktree_cleanup="${5:-include}"

  # Sweep the *.rej hunk rejects a failed 'git apply' / 'patch' leaves behind. They are
  # untracked and gitignored, so they survive every reset below and quietly rot next to the
  # file they failed on. Search from repo_root so nested folders get cleaned too.
  _log_progress_step "$total_steps" "🗑️ Removing *.rej patch rejects"
  local rej_files
  rej_files=$(command find "$repo_root" \( -name .git -o -name node_modules \) -prune -o -type f -name '*.rej' -print 2> /dev/null)
  if [ -z "$rej_files" ]; then
    printf '%s\n' "-> no *.rej files found"
  else
    printf '%s\n' "$rej_files" | while IFS= read -r rej_file; do
      command rm -f "$rej_file"
      printf '%s\n' "-> removed $rej_file"
    done
    printf '%s\n' "-> removed $(printf '%s\n' "$rej_files" | command grep -c .) *.rej file(s)"
  fi

  # Sweep macOS Finder junk (.DS_Store) nested anywhere in the repo. Untracked and usually
  # gitignored, so it survives every reset below. Search from repo_root so nested folders get
  # cleaned too. .git and node_modules are pruned, same as the *.rej sweep.
  _log_progress_step "$total_steps" "🗑️ Removing .DS_Store files"
  local ds_store_count
  ds_store_count=$(command find "$repo_root" \( -name .git -o -name node_modules \) -prune -o -type f -name '.DS_Store' -print 2> /dev/null | command grep -c .)
  if [ "${ds_store_count:-0}" -eq 0 ]; then
    printf '%s\n' "-> no .DS_Store files found"
  else
    command find "$repo_root" \( -name .git -o -name node_modules \) -prune -o -type f -name '.DS_Store' -exec rm -f {} + 2> /dev/null
    printf '%s\n' "-> removed $ds_store_count .DS_Store file(s)"
  fi

  _log_progress_step "$total_steps" "🗑️ Removing empty Claude worktree folders"
  _clean_claude_worktrees "$repo_root"

  _log_progress_step "$total_steps" "🗑️ Deleting branches with gone upstream"
  git --no-pager clean-stale-branches

  _log_progress_step "$total_steps" "🗑️ Deleting merged branches and pruned tags"
  git --no-pager clean-merged-branches-and-tags

  if [ "$worktree_cleanup" = "skip" ]; then
    printf '%s\n' "-> Git worktree cleanup skipped (--skip-worktree-clean)"
  elif ((force_worktrees)); then
    _log_progress_step "$total_steps" "🗑️ Removing ALL worktrees (--force)"
    git --no-pager worktree prune
    worktree_clean --force
  else
    # Placeholder drafts are parked pre-implementation and must survive cleanup until
    # real code lands. Use the standalone cleaner here — it checks GitHub PR state,
    # including the draft+Placeholder convention, before reaping a clean worktree.
    _log_progress_step "$total_steps" "🗑️ Cleaning merged/gone worktrees"
    worktree_clean
  fi

  printf '%s\n' "# ---- ✅ Reset to origin/$default_branch (100% done) ----"
  git --no-pager lastd
}

# Safely resets the current branch to origin's default branch.
# Prompts only when an index lock exists, then stashes staged, unstaged, and untracked work.
# Ignored files are excluded; stash/status failure stops cleanup before aborting operations.
# Recover with `git stash list` / `git stash pop --index`. Deletes untracked *.rej patch rejects; leaves
# every other untracked working-tree file alone. Also sweeps nested .DS_Store Finder junk.
# Pins the repo-local user.email to your email used in the last 50 commits (git fix-identity).
# Also deletes stale local branches (squash-merged PRs), branches fully merged into the default
# branch, local tags that no longer exist on origin, and prunes and removes merged/gone worktrees.
# After successful rebase, optionally initializes/syncs CodeGraph quietly in the background.
# With --force / -f, every worktree is removed instead, skipping the dirty/merged checks.
# With --background / -b, the slow tail returns early and keeps printing progress below the prompt.
# With --skip-worktree-clean, Git worktree cleanup is skipped even when --force is present.
# Returns 1 for help, cancellation, backup/preflight/default-branch failure; otherwise 0 for
# background launch or the tail's status. Lock removal requires confirmation that other Git commands stopped.
function clean() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "clean: safely reset current branch to origin's default branch
  Usage: clean [--force|-f] [--background|-b] [--skip-worktree-clean]
  Notes:
    - Prompts only when index.lock exists; confirm no other Git command is running before removal
    - Stashes staged + unstaged + untracked files first; ignored files are NOT included
    - Stops if stashing or backup verification fails; never continues without a clean working tree
    - Recover from stash with: git stash list; git stash pop --index
    - Deletes untracked *.rej files (failed 'git apply' hunk rejects); keeps all other untracked files
    - Deletes nested .DS_Store files (macOS Finder junk)
    - Pins the repo-local user.email to your email used in the last 50 commits (git fix-identity)
    - After successful rebase, initializes/syncs CodeGraph quietly in the background when codegraph and codegraph_refresh are installed
    - Also deletes stale local branches (squash-merged PRs), merged branches, stale local tags, and prunes and removes merged/gone worktrees
    - --force / -f: ALSO remove EVERY worktree, skipping the dirty/merged checks (uncommitted work in those worktrees is lost)
    - --background / -b: return after the branch reset and let remaining cleanup steps keep printing below the prompt
    - --skip-worktree-clean: skip Git worktree pruning/removal, even with --force; all other cleanup still runs"
    return 1
  fi

  local force_worktrees=0
  local background_tail=0
  local worktree_cleanup="include"
  while [ $# -gt 0 ]; do
    case "$1" in
    --force | -f)
      force_worktrees=1
      ;;
    --background | -b)
      background_tail=1
      ;;
    --skip-worktree-clean)
      worktree_cleanup="skip"
      ;;
    esac
    shift
  done

  local total_steps=17
  if [ "$worktree_cleanup" = "skip" ]; then
    total_steps=$((total_steps - 1))
  fi
  _PROGRESS_STEP=0

  # Git resolves metadata correctly from nested folders and linked worktrees.
  local repo_root index_lock
  repo_root=$(git --no-pager rev-parse --show-toplevel) || return 1
  index_lock=$(git --no-pager rev-parse --git-path index.lock) || return 1

  printf '%s\n' "-> repository: $repo_root"
  printf '%s\n' "-> back up staged, unstaged, and untracked files; ignored files are not included"
  printf '%s\n' "-> reset to origin's default branch; remove *.rej, .DS_Store, stale branches/tags, and eligible worktrees"
  if ((force_worktrees)) && [ "$worktree_cleanup" != "skip" ]; then
    printf '%s\n' "-> WARNING: --force also deletes dirty worktrees; their uncommitted work is NOT backed up"
  fi
  if [ -e "$index_lock" ] || [ -L "$index_lock" ]; then
    printf '%s\n' "-> remove index lock: $index_lock"
    # Only the operator can confirm an abandoned lock; never infer that from its age.
    if ! prompt_yes_no "Remove this index lock and continue? Confirm no other Git command is running" N; then
      printf '%s\n' "-> cleanup cancelled; no changes made"
      return 1
    fi
    if ! command rm -f -- "$index_lock"; then
      printf '%s\n' "clean: could not remove index lock; cleanup stopped" >&2
      return 1
    fi
    printf '%s\n' "-> removed index lock: $index_lock"
  fi

  local stash_msg pending_changes
  stash_msg="clean backup $(command date +%Y-%m-%d_%H:%M:%S)"
  _log_progress_step "$total_steps" "💾 Stashing all changes as '$stash_msg'"
  pending_changes=$(git --no-pager status --porcelain --untracked-files=all) || {
    printf '%s\n' "clean: could not inspect local changes; cleanup stopped" >&2
    return 1
  }
  if [ -n "$pending_changes" ]; then
    if ! git --no-pager stash push --include-untracked --message "$stash_msg" > /dev/null; then
      printf '%s\n' "clean: safety stash failed; cleanup stopped" >&2
      return 1
    fi
    printf '%s\n' "-> recover with: git stash list; git stash pop --index"
  else
    printf '%s\n' "-> no local changes to stash"
  fi
  pending_changes=$(git --no-pager status --porcelain --untracked-files=all) || {
    printf '%s\n' "clean: could not verify safety backup; cleanup stopped" >&2
    return 1
  }
  if [ -n "$pending_changes" ]; then
    printf '%s\n' "clean: local changes remain after safety backup; cleanup stopped" >&2
    return 1
  fi

  # Abort operations only after verifying the safety backup; never discard an unstashable index.
  _log_progress_step "$total_steps" "🛑 Aborting in-progress merge/rebase/cherry-pick/am"
  command rm -rf .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2> /dev/null
  git --no-pager merge --abort 2> /dev/null
  git --no-pager rebase --abort 2> /dev/null
  git --no-pager cherry-pick --abort 2> /dev/null
  git --no-pager am --abort 2> /dev/null

  # Match the last 50 commit author emails against the emails on file and pin the repo-local
  # user.email to the match, so commits here keep the identity this repo already uses.
  _log_progress_step "$total_steps" "🔧 Syncing local git identity from recent commits"
  git --no-pager fix-identity

  _log_progress_step "$total_steps" "⬇️ Fetching origin"
  git --no-pager clean-and-fetch

  _log_progress_step "$total_steps" "🧹 Garbage-collecting (if >14d)"
  git --no-pager gc-if-stale

  _log_progress_step "$total_steps" "🔧 Resolving default branch"
  local default_branch
  default_branch=$(_get_default_branch) || return 1
  printf '%s\n' "-> default branch: $default_branch"

  local current_branch
  current_branch=$(git --no-pager branch --show-current)
  printf '%s\n' "-> current branch: $current_branch"

  # Back up current branch to a temp branch
  local temp_branch="temp/$(command date +%Y%m%d-%H%M%S)"
  _log_progress_step "$total_steps" "💾 Backing up to $temp_branch"
  git --no-pager checkout -b "$temp_branch" > /dev/null 2>&1

  _log_progress_step "$total_steps" "🗑️ Deleting local '$default_branch'"
  git --no-pager del "$default_branch" > /dev/null 2>&1

  _log_progress_step "$total_steps" "🔀 Checking out '$default_branch'"
  git --no-pager checkout "$default_branch" > /dev/null 2>&1

  _log_progress_step "$total_steps" "🔀 Rebasing onto 'origin/$default_branch'"
  if git --no-pager rebase "origin/$default_branch" > /dev/null 2>&1; then
    # Reuse the worktree-local init/sync guards without delaying cleanup or leaking indexer output.
    if type -P codegraph > /dev/null 2>&1 && type -P codegraph_refresh > /dev/null 2>&1; then
      printf '%s\n' "-> CodeGraph refresh started in background (init/sync; output suppressed)"
      (codegraph_refresh "$repo_root") < /dev/null > /dev/null 2>&1 &
    fi
  fi

  _log_progress_step "$total_steps" "🗑️ Deleting $temp_branch"
  git --no-pager del "$temp_branch" > /dev/null 2>&1

  # These cleanup operations are independent from the branch reset, but callers normally expect
  # clean() to finish before the next command starts. Run the tail in the foreground by default
  # so progress stays linear; keep --background as an explicit opt-in for fire-and-forget use.
  if ((background_tail)); then
    printf '%s\n' "-> background cleanup offloaded; progress continues below"
    _clean_background_tail "$total_steps" "$repo_root" "$force_worktrees" "$default_branch" "$worktree_cleanup" &
    return 0
  fi

  _clean_background_tail "$total_steps" "$repo_root" "$force_worktrees" "$default_branch" "$worktree_cleanup"
}

# Creates an empty commit on a new branch and pushes it to trigger a deployment
function commit_empty_trigger_deploy() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "commit_empty_trigger_deploy: push an empty commit on a throwaway branch to trigger a deploy
  Usage: commit_empty_trigger_deploy
  Creates branch 'empty-commit-<epoch>', commits --allow-empty, and pushes it to origin."
    return 0
  fi
  local temp_branch_name="empty-commit-$(command date +%s)"
  git checkout -b "$temp_branch_name" > /dev/null 2>&1
  git commit --allow-empty -m "Trigger deployment - EMPTY PR" > /dev/null 2>&1
  git push -u origin "$temp_branch_name" > /dev/null 2>&1
}

# cd to git home directory ($MY_GIT_HOME or ~/git)
function gogit() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "gogit: cd to git home directory (MY_GIT_HOME or ~/git)
  Usage: gogit [subfolder]"
    return 0
  fi
  local git_home="${MY_GIT_HOME:-$HOME/git}"
  mkdir -p "$git_home" 2> /dev/null
  cd "$git_home"
  if [ -n "${1:-}" ]; then
    cd "$@"
  fi
}

# clone a repo by URL or owner/repo shorthand, tries SSH then falls back to HTTPS
function clone() {
  if [ -z "${1:-}" ] || is_help_arg "${1:-}"; then
    printf '%s\n' "clone: clone a repo by URL or owner/repo shorthand
  Usage: clone <url-or-owner/repo> [destination_folder]
  Examples:
    clone git@github.com:synle/bashrc.git
    clone https://github.com/synle/bashrc.git
    clone synle/bashrc
    clone synle/bashrc \"$HOME/git/bashrc\""
    return 1
  fi

  local input="$1"
  local clone_url=""

  if [[ "$input" =~ ^git@ ]] || [[ "$input" =~ ^https:// ]] || [[ "$input" =~ ^ssh:// ]]; then
    # Full SSH or HTTPS URL — use as-is
    clone_url="$input"
    if ! git ls-remote "$clone_url" &> /dev/null; then
      printf '%s\n' "clone: cannot access '$clone_url'"
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
      printf '%s\n' "clone: SSH access failed, falling back to HTTPS"
    else
      printf '%s\n' "clone: cannot access '$input' via SSH or HTTPS"
      return 1
    fi
  else
    printf '%s\n' "clone: invalid input '$input' — expected a URL or owner/repo"
    return 1
  fi

  if [ "$#" -gt 2 ]; then
    printf '%s\n' "clone: expected <url-or-owner/repo> [destination_folder]"
    return 1
  fi

  if [ "$#" -eq 1 ]; then
    git cl1 "$clone_url"
    return $?
  fi

  local destination_folder="${2%/}"
  if [ -z "$destination_folder" ] || [ "$destination_folder" = "." ] || [ "$destination_folder" = ".." ]; then
    printf '%s\n' "clone: destination_folder must name a new folder"
    return 1
  fi
  if [ -e "$destination_folder" ] || [ -L "$destination_folder" ]; then
    printf '%s\n' "clone: destination already exists: $destination_folder"
    return 1
  fi

  local destination_parent="${destination_folder%/*}"
  local destination_name="${destination_folder##*/}"
  [ "$destination_parent" = "$destination_folder" ] && destination_parent="."
  if [ ! -d "$destination_parent" ]; then
    printf '%s\n' "clone: destination parent does not exist: $destination_parent"
    return 1
  fi

  local destination_path
  destination_path="$(cd "$destination_parent" && pwd)/$destination_name"
  if ! git clone1 "$clone_url" "$destination_folder"; then
    printf '%s\n' "clone: clone failed: $clone_url"
    return 1
  fi
  printf '%s\n' "Cloned repository: $destination_path"
}

# cd to Downloads directory (tries multiple paths in order)
function godownload() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "godownload: cd to the Downloads folder
  Usage: godownload [subfolder]
  Tries \$HOME/Downloads, /mnt/d/Downloads, and on WSL the Windows user Downloads folder."
    return 0
  fi
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
    printf '%s\n' "godownload: no Downloads folder found"
    return 1
  }
  cd "$target"
  if [ -n "${1:-}" ]; then
    cd "$@"
  fi
}

################################################################################
# --- Git Worktrees ---
# Every worktree on this machine lives at:
#   $HOME/.worktrees/<owner>/<repo>/<sanitized-branch>
# The standalone `worktree_create` command owns path derivation, sanitization,
# reuse, and recovery. This wrapper adds only human conveniences.
################################################################################

# git_create_worktree <branch> - Create or reuse the canonical worktree, then cd into it
function git_create_worktree() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "git_create_worktree: create or reuse the canonical worktree for a branch, then cd into it
  Usage: git_create_worktree <branch>
  Layout:
    \$HOME/.worktrees/<owner>/<repo>/<sanitized-branch>
  Notes:
    - <owner> and <repo> come from the origin remote, never from the folder name
    - every non-alphanumeric branch character becomes '_'
    - reuses a linked worktree already on <branch>, and never the primary checkout
    - falls back to a detached worktree when <branch> is checked out in the primary checkout
    - print the path without creating anything: worktree_create --path-only <branch>
    - remove merged/gone worktrees later with: git clean-worktree"
    return 1
  fi

  if [ -z "${1:-}" ]; then
    printf '%s\n' "git_create_worktree: a branch name is required (see: git_create_worktree --help)"
    return 1
  fi

  if ! type -P worktree_create > /dev/null 2>&1; then
    printf '%s\n' "git_create_worktree: worktree_create is not installed — run: ./run --files=git-functions.js" >&2
    return 1
  fi

  local target
  target=$(command worktree_create "$1") || return 1

  print_action_summary "$target"
  cd "$target"
}

# worktree_cd: change to a worktree matching branch and optional repository keywords.
# Args: branch keyword, optional org/repo keyword (case-insensitive substrings).
# Returns 0 after navigation/cancellation; nonzero on invalid input, no match, or failure.
# Prints an action summary before changing this shell's folder; prompts only through the terminal.
function worktree_cd() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "worktree_cd: change to a worktree matching branch and optional repository keywords.
  Usage: worktree_cd <branch_keyword> [repo_keyword]
  Alias: worktree_navigate
  Search: worktree_list inventory; omit repo_keyword to search every listed repository.
  One match navigates directly. Multiple matches show at most 10 choices; enter a number or n to cancel.
  Ambiguous selection requires terminal input; pipeline stdin is never consumed."
    return 0
  fi
  if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ -z "$1" ]; then
    printf '%s\n' "worktree_cd: expected <branch_keyword> [repo_keyword]" >&2
    return 1
  fi
  if ! type -P worktree_list > /dev/null 2>&1 || ! type -P node > /dev/null 2>&1; then
    printf '%s\n' "worktree_cd: worktree_list and node must be installed" >&2
    return 1
  fi

  local inventory results node_script encoded label choice target
  local max_choices=10 choice_timeout=60 selected=0 index=0
  local -a paths=() labels=()
  inventory=$(command worktree_list --raw) || return $?
  IFS= read -r -d '' node_script << 'WORKTREE_CD_NODE' || true
const fs = require('fs');
const path = require('path');
const branch = process.argv[1].toLowerCase();
const repo = process.argv[2].toLowerCase();
const limit = Number(process.argv[3]);
let rows;
try {
  rows = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (error) {
  if (!(error instanceof SyntaxError)) throw error;
  process.stderr.write('worktree_cd: invalid JSON from worktree_list\n');
  process.exit(1);
}
if (!Array.isArray(rows) || rows.some((row) =>
  row === null || typeof row !== 'object' ||
  (row.branch_name !== null && typeof row.branch_name !== 'string') ||
  (row.org !== null && typeof row.org !== 'string') || typeof row.repo !== 'string' ||
  typeof row.worktree_path !== 'string' || !path.isAbsolute(row.worktree_path) || row.worktree_path.includes('\0')
)) {
  process.stderr.write('worktree_cd: invalid inventory from worktree_list\n');
  process.exit(1);
}
/** Escape terminal controls in menu labels without changing path bytes. @param {string} value @returns {string} */
function display(value) {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}
const matches = rows.filter((row) => row.branch_name !== null && row.branch_name.toLowerCase().includes(branch) &&
  ((row.org === null ? '' : row.org + '/') + row.repo).toLowerCase().includes(repo));
for (const row of matches.slice(0, limit)) {
  const name = (row.org === null ? '' : row.org + '/') + row.repo;
  process.stdout.write(Buffer.from(row.worktree_path).toString('base64') + '\t' +
    display(row.branch_name + ' ' + name + ' ' + row.worktree_path) + '\n');
}
WORKTREE_CD_NODE
  results=$(printf '%s' "$inventory" | command node -e "$node_script" -- "$1" "${2:-}" "$max_choices") || return $?
  if [ -z "$results" ]; then
    printf '%s\n' "worktree_cd: no matching worktrees" >&2
    return 1
  fi
  while IFS=$'\t' read -r encoded label; do
    paths+=("$encoded")
    labels+=("$label")
  done <<< "$results"

  if [ "${#paths[@]}" -gt 1 ]; then
    printf '%s\n' "Matching worktrees (at most $max_choices shown):" >&2
    while [ "$index" -lt "${#paths[@]}" ]; do
      printf '  %s) %s\n' "$((index + 1))" "${labels[$index]}" >&2
      index=$((index + 1))
    done
    if [ ! -t 0 ] || ! { : < /dev/tty; } 2> /dev/null; then
      printf '%s\n' "worktree_cd: multiple matches require a terminal; refine the keywords" >&2
      return 1
    fi
    while true; do
      printf 'Choose 1-%s or n to exit: ' "${#paths[@]}" >&2
      IFS= read -r -t "$choice_timeout" choice < /dev/tty || return 1
      case "$choice" in
      n | N) return 0 ;;
      [1-9] | 10)
        if [ "$choice" -le "${#paths[@]}" ]; then
          selected=$((choice - 1))
          break
        fi
        ;;
      esac
      printf '%s\n' "worktree_cd: invalid choice" >&2
    done
  fi

  # A sentinel preserves trailing newlines that command substitution would otherwise remove.
  target=$(command node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString("utf8") + ".")' -- "${paths[$selected]}") || return $?
  target=${target%.}
  if [ ! -d "$target" ]; then
    printf '%s\n' "worktree_cd: selected folder no longer exists" >&2
    return 1
  fi
  print_action_summary "$target" || return $?
  builtin cd -- "$target"
}
alias worktree_navigate="worktree_cd"
# Explicit opt-ins to destructive cleanup and per-worktree confirmation.
alias worktree_purge="worktree_clean --mode purge"
alias worktree_clean_interactive="worktree_clean --mode interactive"

################################################################################
# --- Git Patch Transfer ---
# Moving commits between machines through plain, Base64, or Base85 workflows:
#   patch / patch_85  — verified Base85 envelope; apply or export unpushed commits
#   patch_64          — verified Base64 envelope
#   patch_plain_str   — the same workflow with a plain diff
#   git_patch_create / git_patch_apply — explicit legacy plain create/apply verbs
#
# Both sides funnel through one generator (_git_patch_write) and one applier
# (_git_patch_apply_file), so whatever `create` emitted is exactly what `apply`
# consumes no matter which transport carried it. The shared folder is optional
# everywhere: create says so and moves on, apply says so and gives up.
################################################################################

# The label `git patch-clean` writes above a commit message, so a patch opened by eye
# says where its message starts. It is readability only — the readers here bound the
# message by the two lines format-patch writes anyway, `Subject:` and a bare `---`, and
# merely skip this line. Every reader matches on this one value instead of repeating the
# literal. The producing side is the `patch-clean` alias in software/scripts/git.gitconfig
# — change the fence there and here in the same edit. Styled as the repo's own
# `# --- Title ---` section marker.
_GIT_PATCH_COMMIT_MSG_FENCE="# --- SY_GIT_PATCH_COMMIT_MSG_FENCE ---"

# Shared 50-hash display divider for plain patch sections and Base64 frames.
_GIT_PATCH_DIVIDER="##################################################"

# _git_patch_temp_file: echo a patch path inside a fresh throwaway folder
function _git_patch_temp_file() {
  # A throwaway mktemp folder gives uniqueness for free — no timestamp, no
  # nested bookkeeping path, and the plain `mktemp -d` retry covers hosts
  # where /tmp is not writable (Termux) via the mktemp polyfill.
  local patch_folder
  patch_folder=$(mktemp -d "/tmp/patch-XXXXXX" 2> /dev/null || mktemp -d) || return 1
  printf '%s\n' "$patch_folder/${1:-patch.patch}"
}

# _git_patch_repo_slug: normalize a remote URL to owner/repo.
# $1 is an optional remote URL; otherwise reads origin. Returns nonzero for invalid remotes.
function _git_patch_repo_slug() {
  local remote_url
  if [ "$#" -gt 0 ]; then
    remote_url="$1"
  else
    remote_url=$(git remote get-url origin 2> /dev/null) || return 1
  fi
  remote_url="${remote_url%/}"
  remote_url="${remote_url%.git}"
  if [[ "$remote_url" =~ [:/]([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)$ ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

# _git_patch_write: render the last N commits into a patch file (the only generator).
# $1 is output file; $2 is commit count. Writes oldest-first repo labels and commit subjects.
# Returns nonzero when commits or the origin owner/repo cannot be resolved.
function _git_patch_write() {
  local patch_file="$1" count="${2:-1}" shas remote_url repo_slug
  shas=$(git rev-list --reverse -n "$count" HEAD 2> /dev/null) || return 1
  [ -n "$shas" ] || return 1
  remote_url=$(git remote get-url origin 2> /dev/null) || remote_url=""
  if ! repo_slug=$(_git_patch_repo_slug "$remote_url"); then
    printf '%s\n' ">>> could not resolve origin owner/repo for patch boundaries" >&2
    return 1
  fi
  : > "$patch_file"
  local index=0 sha short_sha commit_subject
  while IFS= read -r sha; do
    index=$((index + 1))
    short_sha=$(git rev-parse --short "$sha") || return 1
    commit_subject=$(git log -1 --format=%s "$sha") || return 1
    commit_subject=$(printf '%s' "$commit_subject" | command tr '\001-\037\177' ' ')
    {
      printf '%s\n' "# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · $repo_slug · patch $index of $count · $short_sha"
      printf '%s\n' "# Commit: $commit_subject"
      printf '%s\n' "$_GIT_PATCH_DIVIDER"
      git --no-pager format-patch -1 "$sha" --stdout | git patch-clean
      printf '%s\n' "$_GIT_PATCH_DIVIDER"
      printf '%s\n' "# END SY_GIT_PATCH_BOUNDARY_v1 · $repo_slug · patch $index of $count · $short_sha"
      printf '%s\n' ""
    } >> "$patch_file" 2> /dev/null || return 1
  done <<< "$shas"
  [ -s "$patch_file" ]
}

# _git_patch_looks_like_patch: true when a file's head reads like a unified diff
function _git_patch_looks_like_patch() {
  local patch_file="$1"
  [ -s "$patch_file" ] || return 1
  # Repeated -e instead of an alternation: BRE `\|` is a GNU extension the BSD
  # grep on macOS does not owe us, and -E is off the table under an rg alias.
  command head -n 40 "$patch_file" | command grep -q -e "^diff --git " -e "^--- " -e "^From [0-9a-f]"
}

# _git_patch_64_codec: encode/decode $2 into $3 with an embedded SHA-256 digest.
# $1 is encode or decode; exports take each display preview from its patch boundary.
# Exports use one repo/order/SHA-labelled frame per section, with Commit preview
# and paired dividers. Decoding pairs marker prefixes only; suffixes are display-only.
# Accepts frame sequences, older previews without dividers, and bare Base64.
# Returns 0 on success, 1 on corruption/I/O failure, or 2 for unrelated clipboard
# text. Decoding writes only after validating every wrapper and payload.
function _git_patch_64_codec() {
  if ! type -P node > /dev/null 2>&1; then
    printf '%s\n' "patch_64: node is required for the Base64 envelope" >&2
    return 1
  fi
  local codec_js
  IFS= read -r -d '' codec_js << '_PATCH_64_EOF_' || true
/** Encode a versioned byte envelope or validate it before writing decoded bytes. */
const fs = require('fs'), crypto = require('crypto');
/** Wire magic includes the version; the digest covers only the original patch. */
const magic = 'SY_GIT_PATCH_64_v2\n';
/** Envelope family distinguishes damaged transfers from unrelated clipboard text. */
const family = 'SY_GIT_PATCH_64';
/** Display boundaries share the wire version but sit outside the encoded bytes. */
const begin = '# BEGIN ' + magic.trim(), end = '# END ' + magic.trim();
/** Shared shell-defined separator immediately before and after each payload. */
const divider = process.env._PATCH_64_DIVIDER;
/** Reject malformed input without writing output; message is safe diagnostic text. */
function fail(message) {
  process.stderr.write('patch_64: ' + message + '\n');
  process.exit(1);
}
try {
  const input = fs.readFileSync(process.env._PATCH_64_INPUT);
  if (process.env._PATCH_64_MODE === 'encode') {
    // Latin-1 slicing preserves every patch byte; labels alone are UTF-8 text.
    const source = input.toString('latin1');
    const sections = [...source.matchAll(/^# BEGIN SY_GIT_PATCH_BOUNDARY_v1([^\n]*)\n[\s\S]*?^# END SY_GIT_PATCH_BOUNDARY_v1\1\n\n/gm)];
    if (!sections.length || sections.map(section => section[0]).join('') !== source) {
      fail('malformed plain patch boundaries');
    }
    const frames = sections.map(section => {
      const patch = Buffer.from(section[0], 'latin1');
      const label = Buffer.from(section[1], 'latin1').toString('utf8');
      const digest = crypto.createHash('sha256').update(patch).digest('hex');
      const commitLine = section[0].match(/^# Commit: ([^\n]*)$/m);
      const preview = commitLine
        ? Buffer.from(commitLine[1], 'latin1').toString('utf8').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').trim()
        : '';
      const encoded = Buffer.concat([Buffer.from(magic + digest + '\n'), patch]).toString('base64');
      return begin + label + '\n# Commit: ' + preview + '\n' + divider + '\n' + encoded.match(/.{1,76}/g).join('\n') + '\n' + divider + '\n' + end + label + '\n';
    });
    fs.writeFileSync(process.env._PATCH_64_OUTPUT, frames.join('\n'));
  } else {
    const text = input.toString('latin1').replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
    const framed = text.includes('# BEGIN ' + family) || text.includes('# END ' + family);
    let payloads = [text];
    if (framed) {
      const framePattern = new RegExp('^' + begin + '[^\\r\\n]*\\r?\\n# [^\\r\\n]*\\r?\\n([\\s\\S]*?)\\r?\\n' + end + '[^\\r\\n]*(?=\\r?\\n|$)', 'gm');
      const frames = [...text.matchAll(framePattern)];
      if (!frames.length || text.replace(framePattern, '').replace(/[ \t\r\n]/g, '') !== '') {
        fail('malformed Base64 envelope boundaries or preview');
      }
      // Only prefixes define pairs. Old frames need no divider or Commit label.
      payloads = frames.map(frame => frame[1]
        .replace(/^### -+(?: ###)?\r?\n/, '')
        .replace(new RegExp('^' + divider + '\\r?\\n|\\r?\\n' + divider + '$', 'g'), ''));
    }
    // Validate the entire batch before writing anything the applier can consume.
    const patches = payloads.map(payload => {
      // Only ASCII transport whitespace is ignorable, never punctuation or Unicode.
      const encoded = payload.replace(/[ \t\r\n]/g, '');
      const decoded = Buffer.from(encoded, 'base64');
      const hasFamily = decoded.subarray(0, family.length).toString('latin1') === family;
      // Long Base64-looking input may have a damaged magic prefix; never overwrite it.
      const minimumEnvelopeLength = Math.ceil((magic.length + 64 + 1) / 3) * 4;
      const looksEncoded = encoded.length >= minimumEnvelopeLength && /^[A-Za-z0-9+/=]+$/.test(encoded);
      if (!hasFamily && !looksEncoded) {
        if (framed) fail('invalid Base64 envelope payload');
        process.exit(2);
      }
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || decoded.toString('base64') !== encoded) {
        fail('invalid or noncanonical Base64 envelope');
      }
      const version = decoded.subarray(0, magic.length).toString('latin1');
      if (version !== magic && version !== family + '_v1\n') fail('unsupported Base64 envelope version');
      const digestEnd = magic.length + 64;
      const digest = decoded.subarray(magic.length, digestEnd).toString('latin1');
      if (!/^[0-9a-f]{64}$/.test(digest) || decoded[digestEnd] !== 10) fail('malformed Base64 envelope digest');
      const patch = decoded.subarray(digestEnd + 1);
      if (crypto.createHash('sha256').update(patch).digest('hex') !== digest) fail('SHA-256 mismatch; patch not applied');
      return patch;
    });
    fs.writeFileSync(process.env._PATCH_64_OUTPUT, Buffer.concat(patches));
  }
} catch (error) {
  if (!error.code) throw error;
  fail('cannot read or write Base64 envelope (' + error.code + ')');
}
_PATCH_64_EOF_
  _PATCH_64_MODE="$1" _PATCH_64_INPUT="$2" _PATCH_64_OUTPUT="$3" _PATCH_64_DIVIDER="$_GIT_PATCH_DIVIDER" node -e "$codec_js"
}

# _git_patch_format_name: return the public command name for one transfer format.
# Returns nonzero for unknown formats.
function _git_patch_format_name() {
  case "$1" in
  plain) printf '%s\n' patch_plain_str ;;
  base64) printf '%s\n' patch_64 ;;
  base85) printf '%s\n' patch_85 ;;
  *) return 1 ;;
  esac
}

# _git_patch_85_codec: encode/decode $2 into $3 using canonical unframed ASCII85.
# Arguments: encode/decode, input file, output file. Writes only verified patch bytes.
# Returns 2 for unrelated clipboard text, 1 for malformed envelopes or I/O failures.
function _git_patch_85_codec() {
  _snip_require_binary node || return 1
  _ensure_base85_module || return $?
  local codec_js module_path="$HOME/.local/lib/node_modules/base85"
  IFS= read -r -d '' codec_js << '_PATCH_85_EOF_' || true
/** Encode a versioned byte envelope or validate it before writing decoded bytes. */
const fs = require('fs'), crypto = require('crypto');
const base85 = require(process.env._PATCH_85_MODULE_PATH);
/** Wire magic includes the version; the digest covers only the original patch. */
const magic = 'SY_GIT_PATCH_85_v1\n';
/** Envelope family distinguishes damaged transfers from unrelated clipboard text. */
const family = 'SY_GIT_PATCH_85';
/** Display boundaries share the wire version but sit outside the encoded bytes. */
const begin = '# BEGIN ' + magic.trim(), end = '# END ' + magic.trim();
/** Shared shell-defined separator immediately before and after each payload. */
const divider = process.env._PATCH_85_DIVIDER;
/** Reject malformed input without writing output; message is safe diagnostic text. */
function fail(message) {
  process.stderr.write('patch_85: ' + message + '\n');
  process.exit(1);
}
try {
  const input = fs.readFileSync(process.env._PATCH_85_INPUT);
  if (process.env._PATCH_85_MODE === 'encode') {
    // Latin-1 slicing preserves every patch byte; labels alone are UTF-8 text.
    const source = input.toString('latin1');
    const sections = [...source.matchAll(/^# BEGIN SY_GIT_PATCH_BOUNDARY_v1([^\n]*)\n[\s\S]*?^# END SY_GIT_PATCH_BOUNDARY_v1\1\n\n/gm)];
    if (!sections.length || sections.map(section => section[0]).join('') !== source) {
      fail('malformed plain patch boundaries');
    }
    const frames = sections.map(section => {
      const patch = Buffer.from(section[0], 'latin1');
      const label = Buffer.from(section[1], 'latin1').toString('utf8');
      const digest = crypto.createHash('sha256').update(patch).digest('hex');
      const commitLine = section[0].match(/^# Commit: ([^\n]*)$/m);
      const preview = commitLine
        ? Buffer.from(commitLine[1], 'latin1').toString('utf8').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').trim()
        : '';
      const envelope = Buffer.concat([Buffer.from(magic + digest + '\n'), patch]);
      const encoded = base85.encode(envelope, 'a85');
      if (encoded === false) fail('Base85 encoding failed');
      const payload = (encoded.match(/.{1,76}/g) || ['']).map(line => '> ' + line).join('\n');
      return begin + label + '\n# Commit: ' + preview + '\n' + divider + '\n' + payload + '\n' + divider + '\n' + end + label + '\n';
    });
    fs.writeFileSync(process.env._PATCH_85_OUTPUT, frames.join('\n'));
  } else {
    const text = input.toString('latin1').replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
    const framed = text.includes('# BEGIN ' + family) || text.includes('# END ' + family);
    let payloads = [text];
    if (framed) {
      const framePattern = new RegExp('^' + begin + '[^\\r\\n]*\\r?\\n# [^\\r\\n]*\\r?\\n([\\s\\S]*?)\\r?\\n' + end + '[^\\r\\n]*(?=\\r?\\n|$)', 'gm');
      const frames = [...text.matchAll(framePattern)];
      if (!frames.length || text.replace(framePattern, '').replace(/[ \t\r\n]/g, '') !== '') {
        fail('malformed Base85 envelope boundaries or preview');
      }
      // Only marker prefixes define pairs; encoded lines use a visible quote prefix.
      payloads = frames.map(frame => frame[1]
        .replace(/^### -+(?: ###)?\r?\n/, '')
        .replace(new RegExp('^' + divider + '\\r?\\n|\\r?\\n' + divider + '$', 'g'), '')
        .replace(/^> /gm, ''));
    }
    // Validate every frame before writing any patch the applier can consume.
    const patches = payloads.map(payload => {
      // Only ASCII transport whitespace is ignorable, never punctuation or Unicode.
      const encoded = payload.replace(/[ \t\r\n]/g, '');
      let decoded;
      try {
        decoded = base85.decode(encoded, 'a85');
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        decoded = false;
      }
      const hasFamily = decoded !== false && decoded.subarray(0, family.length).toString('latin1') === family;
      // Classify before canonical validation so unrelated clipboard text can export.
      // Long Base85-looking text still fails closed when its magic is damaged.
      const envelopeLength = magic.length + 64 + 1;
      const minimumEnvelopeLength = Math.ceil(envelopeLength / 4) * 5;
      const looksEncoded = encoded.length >= minimumEnvelopeLength && /^[!-u]+$/.test(encoded);
      if (!hasFamily && !looksEncoded) {
        if (framed) fail('invalid Base85 envelope payload');
        process.exit(2);
      }
      if (decoded === false || base85.encode(decoded, 'a85') !== encoded) {
        fail('invalid or noncanonical Base85 envelope');
      }
      const version = decoded.subarray(0, magic.length).toString('latin1');
      if (version !== magic) fail('unsupported Base85 envelope version');
      const digestEnd = magic.length + 64;
      const digest = decoded.subarray(magic.length, digestEnd).toString('latin1');
      if (!/^[0-9a-f]{64}$/.test(digest) || decoded[digestEnd] !== 10) {
        fail('malformed Base85 envelope digest');
      }
      const patch = decoded.subarray(digestEnd + 1);
      if (crypto.createHash('sha256').update(patch).digest('hex') !== digest) {
        fail('SHA-256 mismatch; patch not applied');
      }
      return patch;
    });
    fs.writeFileSync(process.env._PATCH_85_OUTPUT, Buffer.concat(patches));
  }
} catch (error) {
  if (!error.code) throw error;
  fail('cannot read or write Base85 envelope (' + error.code + ')');
}
_PATCH_85_EOF_
  _PATCH_85_MODE="$1" _PATCH_85_INPUT="$2" _PATCH_85_OUTPUT="$3" \
    _PATCH_85_DIVIDER="$_GIT_PATCH_DIVIDER" _PATCH_85_MODULE_PATH="$module_path" \
    node -e "$codec_js"
}

# _git_patch_codec: dispatch the requested encoded format to its byte codec.
# Arguments: format, encode/decode, input file, output file.
function _git_patch_codec() {
  local format="$1"
  shift
  case "$format" in
  base64) _git_patch_64_codec "$@" ;;
  base85) _git_patch_85_codec "$@" ;;
  *) return 2 ;;
  esac
}

# _git_patch_read_file: prepare $2 in plain, Base64, or Base85 format $1.
# Sets _GIT_PATCH_INPUT_FILE; returns 2 for non-envelope input, 1 for an invalid
# file/envelope, or 0 for a readable patch. Never applies or changes the source.
function _git_patch_read_file() {
  local format="$1" patch_file="$2" command_name
  _GIT_PATCH_INPUT_FILE=""
  if [ ! -f "$patch_file" ]; then
    printf '%s\n' "patch: patch file '$patch_file' not found." >&2
    return 1
  fi
  if [ "$format" = base64 ] || [ "$format" = base85 ]; then
    command_name=$(_git_patch_format_name "$format") || return 2
    local decoded_file status
    decoded_file=$(_git_patch_temp_file decoded.patch) || return 1
    _git_patch_codec "$format" decode "$patch_file" "$decoded_file"
    status=$?
    [ "$status" -eq 0 ] || return "$status"
    if ! _git_patch_looks_like_patch "$decoded_file"; then
      printf '%s\n' "$command_name: $format envelope contains no patch" >&2
      command rm -f "$decoded_file"
      return 1
    fi
    patch_file="$decoded_file"
  fi
  _GIT_PATCH_INPUT_FILE="$patch_file"
}

# _git_patch_clipboard_file: capture a patch in optional $1 format (default plain).
# Sets _GIT_PATCH_CLIPBOARD_FILE on success. Returns 2 for no readable patch,
# 1 for damaged input or allocation failure; never replace recognized damaged input.
function _git_patch_clipboard_file() {
  _GIT_PATCH_CLIPBOARD_FILE=""
  local format="${1:-plain}" patch_file status
  if ! patch_file=$(_git_patch_temp_file "clipboard.patch"); then
    printf '%s\n' ">>> could not create a temp folder for the clipboard patch" >&2
    return 1
  fi

  # Raw paste preserves significant context whitespace for the plain path too.
  if ! paste > "$patch_file" 2> /dev/null; then
    command rm -f "$patch_file"
    return 2
  fi
  if [ "$format" = plain ]; then
    if ! _git_patch_looks_like_patch "$patch_file"; then
      command rm -f "$patch_file"
      return 2
    fi
  elif _git_patch_looks_like_patch "$patch_file"; then
    local command_name
    command_name=$(_git_patch_format_name "$format") || command_name=patch
    printf '%s\n' "$command_name: plain diff rejected; use patch_plain_str for plain patches" >&2
    return 1
  fi
  _git_patch_read_file "$format" "$patch_file"
  status=$?
  if [ "$status" -ne 0 ]; then
    command rm -f "$patch_file"
    return "$status"
  fi
  printf '%s\n' ">>> patch file created $patch_file"
  _GIT_PATCH_CLIPBOARD_FILE="$_GIT_PATCH_INPUT_FILE"
}

# _git_patch_apply_clipboard: apply the clipboard when it holds a diff
# Exit codes: 0 applied, 1 the patch failed to apply, 2 the clipboard holds no patch.
# The 2 is what lets each caller pick its own fallback — dropbox for git_patch_apply,
# cutting a fresh patch for `patch`.
function _git_patch_apply_clipboard() {
  _git_patch_clipboard_file || return $?

  printf '%s\n' ">>> applying patch from clipboard"
  _git_patch_apply_file "$_GIT_PATCH_CLIPBOARD_FILE"
}

# _git_patch_boundary_repo: parse a safe owner/repo slug from a saved boundary line.
# $1 is the one-line metadata file; prints an empty string when the label is legacy or invalid.
function _git_patch_boundary_repo() {
  local metadata_file="$1"
  command awk '
    /^# BEGIN SY_GIT_PATCH_BOUNDARY_v1/ {
      header = $0
      sub(/^# BEGIN SY_GIT_PATCH_BOUNDARY_v1 · /, "", header)
      if (match(header, / · patch [0-9][0-9]* of [0-9][0-9]* · [[:xdigit:]]+$/)) {
        repo = substr(header, 1, RSTART - 1)
        if (repo ~ /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/) print repo
      }
      exit
    }
  ' "$metadata_file"
}

# _git_patch_boundary_commit: read a display subject, falling back to the patch headers.
# $1 is a decoded patch part; prints one sanitized commit subject or a placeholder.
function _git_patch_boundary_commit() {
  local patch_file="$1" subject
  subject=$(command awk '
    /^# Commit: / { sub(/^# Commit: /, ""); print; exit }
  ' "$patch_file")
  if [ -z "$subject" ]; then
    subject=$(_git_patch_subject "$patch_file") || subject=""
  fi
  subject=$(printf '%s' "$subject" | command tr '\001-\037\177' ' ')
  printf '%s\n' "${subject:-unknown commit message}"
}

# _git_patch_prompt_choice: return 0 to apply, 1 to skip, or 2 to quit.
# $1 is the prompt; reads /dev/tty and defaults to Yes on Enter, or quits on EOF.
function _git_patch_prompt_choice() {
  local prompt="$1" reply
  if ! (: < /dev/tty) 2> /dev/null; then
    printf '%s\n' "patch: no terminal available for the per-patch decision; stopping" >&2
    return 2
  fi
  while :; do
    if ! IFS= read -r -p "$prompt " reply < /dev/tty; then
      return 2
    fi
    reply=$(printf '%s' "$reply" | command tr '[:upper:]' '[:lower:]')
    reply=$(printf '%s' "$reply" | command sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    case "$reply" in
    '' | y | yes) return 0 ;;
    n | no) return 1 ;;
    q | quit) return 2 ;;
    esac
    printf 'Enter y, n, or q.\n' > /dev/tty
  done
}

# _git_patch_record_applied: count a successful patch and retain the first full message.
# $1 is the applied patch file; updates shared state for the bundle-level commit step.
function _git_patch_record_applied() {
  _GIT_PATCH_APPLIED_PATCH_COUNT=$((${_GIT_PATCH_APPLIED_PATCH_COUNT:-0} + 1))
  if [ "$_GIT_PATCH_APPLIED_PATCH_COUNT" -eq 1 ]; then
    _GIT_PATCH_FIRST_APPLIED_MESSAGE=$(_git_patch_message "$1")
  fi
}

# _git_patch_apply_file: validate and apply every framed patch through one applier.
# $1 is a patch file; $2 is an optional boundary metadata file for an extracted section.
# $3 defaults to prompt; clipboard-confirmed reuses explicit acceptance for a single patch only.
# Returns nonzero for malformed bundles, quit, or rejected hunks; earlier applied hunks remain.
function _git_patch_apply_file() {
  local patch_file="$1" boundary_file="${2:-}" confirmation="${3:-prompt}"

  if [ -z "$boundary_file" ]; then
    _GIT_PATCH_APPLIED_PATCH_COUNT=0
    _GIT_PATCH_FIRST_APPLIED_MESSAGE=""
  fi

  # Split and validate every boundary before prompting or changing the working tree.
  local patch_count=0
  if [ -z "$boundary_file" ]; then
    patch_count=$(command grep -c "^# BEGIN SY_GIT_PATCH_BOUNDARY_v1" "$patch_file" 2> /dev/null)
    if [ "${patch_count:-0}" -gt 0 ] || command grep -q "^# END SY_GIT_PATCH_BOUNDARY_v1" "$patch_file"; then
      local patch_folder patch_index patch_part patch_metadata current_repo patch_repo patch_subject patch_repo_label mismatch_prompt choice_prompt choice_status
      patch_folder=$(command dirname "$(_git_patch_temp_file multi.patch)") || return 1
      command awk -v folder="$patch_folder" '
        BEGIN { valid = 1 }
        /^# BEGIN SY_GIT_PATCH_BOUNDARY_v1/ {
          if (inside) {
            valid = 0
            next
          }
          inside = 1
          patch_number++
          output = folder "/patch-" patch_number ".patch"
          metadata = folder "/patch-" patch_number ".meta"
          print $0 > metadata
          close(metadata)
          next
        }
        /^# END SY_GIT_PATCH_BOUNDARY_v1/ {
          if (!inside) {
            valid = 0
            next
          }
          inside = 0
          close(output)
          next
        }
        inside { print > output }
        END {
          if (inside || !valid || patch_number == 0) exit 1
        }
      ' "$patch_file" || {
        printf '%s\n' ">>> patch boundary metadata is malformed" >&2
        command rm -rf "$patch_folder"
        return 1
      }

      current_repo=$(_git_patch_repo_slug) || current_repo=""
      patch_index=0
      while [ "$patch_index" -lt "$patch_count" ]; do
        patch_index=$((patch_index + 1))
        patch_part="$patch_folder/patch-$patch_index.patch"
        patch_metadata="$patch_folder/patch-$patch_index.meta"
        if [ ! -s "$patch_part" ]; then
          printf '%s\n' ">>> patch $patch_index/$patch_count is empty or malformed" >&2
          command rm -rf "$patch_folder"
          return 1
        fi

        patch_repo=$(_git_patch_boundary_repo "$patch_metadata")
        mismatch_prompt=""
        if [ -z "$patch_repo" ]; then
          mismatch_prompt="Patch repository is not identified in this legacy boundary; current repository is '${current_repo:-unknown (origin unavailable)}'. Continue applying this patch?"
        elif [ -z "$current_repo" ]; then
          mismatch_prompt="Patch repository '$patch_repo' cannot be matched because the current origin repository is unavailable. Continue applying this patch?"
        elif [ "$patch_repo" != "$current_repo" ]; then
          mismatch_prompt="Patch repository '$patch_repo' does not match current repository '$current_repo'. Continue applying this patch?"
        fi
        if [ -n "$mismatch_prompt" ]; then
          mismatch_prompt=$(printf '\033[41;37m[Need Attention]\033[0m %s' "$mismatch_prompt")
        fi
        if [ -n "$mismatch_prompt" ] && ! prompt_yes_no "$mismatch_prompt" N; then
          printf '%s\n' ">>> skipped patch $patch_index/$patch_count after repository mismatch"
          continue
        fi

        patch_repo_label="${patch_repo:-unknown repository}"
        patch_subject=$(_git_patch_boundary_commit "$patch_part")
        choice_status=0
        if [ "$patch_count" -eq 1 ] && [ "$confirmation" = clipboard-confirmed ]; then
          printf '>>> applying patch %s of %s for %s\nCommit: %s\n' "$patch_index" "$patch_count" "$patch_repo_label" "$patch_subject"
        else
          choice_prompt=$(printf 'Do you wish to apply patch %s of %s for %s?\nCommit: %s\nChoose [quit/n/Y]' "$patch_index" "$patch_count" "$patch_repo_label" "$patch_subject")
          _git_patch_prompt_choice "$choice_prompt"
          choice_status=$?
        fi
        case "$choice_status" in
        0) ;;
        1)
          printf '%s\n' ">>> skipped patch $patch_index/$patch_count"
          continue
          ;;
        *)
          printf '%s\n' ">>> patch application quit before patch $patch_index/$patch_count" >&2
          if [ "${_GIT_PATCH_APPLIED_PATCH_COUNT:-0}" -gt 0 ]; then
            printf '%s\n' ">>> earlier patches remain in the working tree and are not committed" >&2
          fi
          command rm -rf "$patch_folder"
          return 1
          ;;
        esac

        if ! _git_patch_apply_file "$patch_part" "$patch_metadata"; then
          command rm -rf "$patch_folder"
          return 1
        fi
      done
      command rm -rf "$patch_folder"
      return 0
    fi
  fi

  # Dry-run first so a corrupt or already-applied patch is named before the tree changes.
  if git apply --check "$patch_file" 2> /dev/null; then
    git apply --whitespace=fix "$patch_file" || return 1
    _git_patch_record_applied "$patch_file"
    printf '%s\n' ">>> patch applied cleanly $patch_file"
    return 0
  fi

  printf '%s\n' ">>> $patch_file does not apply cleanly — retrying with --reject" >&2
  git apply --reject --whitespace=fix "$patch_file" && {
    _git_patch_record_applied "$patch_file"
    printf '%s\n' ">>> patch applied $patch_file"
    return 0
  }

  # --reject may leave applied hunks plus .rej files; report the partial state explicitly.
  printf '%s\n' ">>> patch partially applied — resolve the .rej files, nothing was committed" >&2
  return 1
}

# _git_patch_upload: copy $1 to reachable shared storage using repo prefix $2.
# Preserve encoded extensions; missing storage is a nonfatal skip.
function _git_patch_upload() {
  local patch_file="$1"
  local repo_name="$2"

  local dropbox_folder
  if ! dropbox_folder=$(_dropbox_folder 2> /dev/null); then
    printf '%s\n' ">>> shared dropbox folder not reachable — skipped upload"
    return 0
  fi

  # Same repo-date prefix `git patch-rename` uses, plus the sha so two patches
  # cut in the same minute cannot collide.
  local target suffix=".patch"
  [[ "$patch_file" = *.b64 ]] && suffix=".patch.b64"
  [[ "$patch_file" = *.b85 ]] && suffix=".patch.b85"
  target="${dropbox_folder}/${repo_name}-$(command date +%Y_%m_%d_%H_%M)-$(git rev-parse --short HEAD 2> /dev/null)${suffix}"
  if command cp "$patch_file" "$target" 2> /dev/null; then
    printf '%s\n' ">>> patch uploaded $target"
    # macOS writes ._ sidecars onto network shares; the reader skips them, but
    # they still clutter the folder for whoever opens it next.
    (type -P dot_clean &> /dev/null && dot_clean "$dropbox_folder" &> /dev/null) &
  else
    printf '%s\n' ">>> could not write $target — skipped upload" >&2
  fi
}

# _git_patch_subject: the commit subject a patch carries, cleaned or not
# `git patch-clean` deliberately empties the `Subject: [PATCH]` header and moves the
# real subject below a `$_GIT_PATCH_COMMIT_MSG_FENCE` fence, which makes `git mailinfo` — and `git am` —
# report no subject at all. Every patch this repo produces goes through that filter, so
# reading the header alone silently commits every transferred patch as "applied patch".
# Try the header first (uncleaned patches, RFC-2047 decoding), then the fence.
# $1 is a patch file; prints its subject, or returns nonzero if the file is missing.
# Remove boundary headers and their leading divider before mailinfo decodes subjects.
function _git_patch_subject() {
  local patch_file="$1"
  [ -f "$patch_file" ] || return 1

  local subject
  subject=$(command awk -v divider="$_GIT_PATCH_DIVIDER" '
    /^# BEGIN SY_GIT_PATCH_BOUNDARY_v1/ { boundary = 1; next }
    boundary && /^# Commit: / { next }
    boundary && $0 == divider { boundary = 0; next }
    { boundary = 0; print }
  ' "$patch_file" \
    | git mailinfo /dev/null /dev/null 2> /dev/null \
    | command grep "^Subject: " | sed 's/^Subject: //')
  if [ -n "$subject" ]; then
    printf '%s\n' "$subject"
    return 0
  fi

  # Fenced form. format-patch folds a long subject across lines with a leading
  # space (RFC 5322), so continuation lines are unfolded back onto one line.
  command awk -v fence_line="$_GIT_PATCH_COMMIT_MSG_FENCE" '
    /^Subject: \[PATCH/ { insub = 1; next }
    insub && $0 == fence_line { fence = 1; next }
    fence && /^$/ { exit }
    fence { line = $0; sub(/^ /, "", line); out = (out == "" ? line : out " " line) }
    END { if (out != "") print out }
  ' "$patch_file"
}

# _git_patch_message: the FULL commit message a cleaned patch carries
# The decoded subject from `_git_patch_subject`, then the body — everything between the
# blank line that follows the subject and the bare `---` format-patch writes before the
# diff. The fence in between is decoration for whoever opens the patch by eye, so it is
# skipped rather than relied on. Co-authored-by trailers are dropped: they belong to the
# machine that authored the commit, and this one re-authors it.
function _git_patch_message() {
  local patch_file="$1"
  [ -f "$patch_file" ] || return 1

  # The subject comes from _git_patch_subject rather than off the page: format-patch
  # RFC-2047-encodes any subject holding a non-ASCII character (an em dash is enough),
  # and folds a long one across lines, so the raw text here is routinely neither one
  # line nor readable. That helper already decodes and unfolds both forms.
  local subject
  subject=$(_git_patch_subject "$patch_file")
  [ -n "$subject" ] || return 1

  # The body is everything from the blank line after the subject to the bare `---`
  # format-patch writes before the diff. `---` is compared whole — a diff's own
  # `--- a/file` has a trailing path. The fence is data, compared with ==, so it
  # never has to be escaped into a regex.
  {
    printf '%s\n' "$subject"
    command awk -v fence_line="$_GIT_PATCH_COMMIT_MSG_FENCE" '
      /^Subject:/ { inside = 1; next }
      inside && $0 == "---" { exit }
      inside && $0 == fence_line { next }
      body { print; next }
      inside && $0 == "" { body = 1; print "" }
    ' "$patch_file"
  } | command grep -v -i "co-authored-by"
}

# _git_patch_copy_message: put a patch's commit message on the clipboard, ready to paste.
# $1 is a decoded patch file; $2 optionally supplies its already parsed full message.
# Returns nonzero when the message is absent or copying fails.
function _git_patch_copy_message() {
  local patch_file="$1" message="${2:-}"

  if [ -z "$message" ]; then
    message=$(_git_patch_message "$patch_file")
  fi
  if [ -z "$message" ]; then
    printf '%s\n' ">>> patch carries no fenced commit message — clipboard left alone" >&2
    return 1
  fi

  printf '%s\n' "$message" | copy --raw || return 1
  printf '%s\n' ">>> commit message copied to clipboard:"
  printf '%s\n' "$message"
}

# _git_patch_commit_applied: copy the first applied patch's message, then commit the bundle.
# $1 is the decoded bundle; returns nonzero on message-copy or commit failure.
function _git_patch_commit_applied() {
  local patch_file="$1"

  _git_patch_copy_message "$patch_file" "${_GIT_PATCH_FIRST_APPLIED_MESSAGE:-}" || return 1
  printf '%s\n' ">>> staging all non-ignored changes with git aac — paste the message in the editor"
  git aac
}

# _git_patch_apply_from_dropbox: apply the newest shared patch, then commit and archive it
function _git_patch_apply_from_dropbox() {
  local dropbox_folder
  if ! dropbox_folder=$(_dropbox_folder 2> /dev/null); then
    printf '%s\n' "git_patch_apply: shared dropbox folder not reachable — nothing to apply." >&2
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
    printf '%s\n' "git_patch_apply: no .patch files found in $dropbox_folder" >&2
    return 1
  fi

  # Decoded commit subject from the patch itself (handles both the RFC-2047 header
  # and the `$_GIT_PATCH_COMMIT_MSG_FENCE` fence patch-clean leaves behind), so the commit lands on
  # this machine under the message it was authored with.
  local commit_msg
  commit_msg=$(_git_patch_subject "$latest_patch")
  commit_msg="${commit_msg:-applied patch}"

  printf '%s\n' ">>> applying shared patch $latest_patch"
  printf '%s\n' ">>> commit message: $commit_msg"

  _git_patch_apply_file "$latest_patch" || return 1

  if ! (git add -A && git commit --allow-empty --no-verify -m "$commit_msg"); then
    printf '%s\n' "git_patch_apply: commit failed — patch was NOT archived." >&2
    return 1
  fi
  # --reset-author so the commit carries this machine's identity rather than the
  # sending machine's; --no-edit keeps it from stalling on an editor.
  git commit --amend --reset-author --no-edit --no-verify > /dev/null \
    || printf '%s\n' ">>> could not reset the commit author — commit kept as authored" >&2
  mv "$latest_patch" "$archive_folder"
  printf '%s\n' ">>> committed and archived to $archive_folder"
}

# _git_patch_send_to_copy_servers: fire-and-forget copy-to-server for a new patch
#
# Sends the patch to every CODE_SERVER_REMOTE copy-server as <repo>-<date_time>.patch,
# .patch.b64, or .patch.b85, preserving the input encoding.
# (copy-to-server also overwrites clipboard.txt there, so copy-from-server on the
# other machine returns this patch). Runs in the background so a slow or down
# server never delays `patch`; output goes to <patch>.copy-to-server.log beside the
# patch so a failed send is still traceable. --no-copy-url keeps the patch, not a
# URL, on the local clipboard. Skips with a one-line reason when copy-to-server or
# its host list is unavailable.
#   $1 - patch file path
#   $2 - repo name (remote file name prefix)
# Returns 0 always (a skipped or failed send never fails patch creation).
function _git_patch_send_to_copy_servers() {
  local patch_file="$1" repo_name="$2"
  if ((is_work_profile)); then
    printf '%s\n' ">>> copy-servers: skipped (work profile)"
    return 0
  fi
  if ! type copy-to-server &> /dev/null; then
    printf '%s\n' ">>> copy-servers: skipped (copy-to-server not loaded)"
    return 0
  fi
  if [ -z "${CODE_SERVER_REMOTE_HOSTS:-}" ]; then
    printf '%s\n' ">>> copy-servers: skipped (no CODE_SERVER_REMOTE hosts; re-run run.sh)"
    return 0
  fi
  local suffix=".patch"
  [[ "$patch_file" = *.b64 ]] && suffix=".patch.b64"
  [[ "$patch_file" = *.b85 ]] && suffix=".patch.b85"
  local remote_name
  remote_name="${repo_name}-$(date +%Y-%m-%d_%H-%M-%S)${suffix}"
  local log_file="${patch_file}.copy-to-server.log"
  (copy-to-server --no-copy-url --name "$remote_name" "$patch_file" < /dev/null > "$log_file" 2>&1 &)
  printf '%s\n' ">>> copy-servers: sending $remote_name in the background to $CODE_SERVER_REMOTE_HOSTS (log: $log_file)"
  return 0
}

# git_patch_create: export [count=1] commits as plain patches to every transport.
# Returns creation status; does not modify the repository.
function git_patch_create() {
  _git_patch_create plain "$@"
}

# _git_patch_create: generate once, then encode before all transports when requested.
# $1 is plain/base64; $2 is count (default 1). Both formats carry one subject preview per patch.
# Returns nonzero on generation, encoding, or clipboard failure; preserves repository state.
function _git_patch_create() {
  local format="$1"
  shift
  if is_help_arg "${1:-}"; then
    printf '%s\n' "git_patch_create: export the last commit as a patch and hand it to every transport
  Usage: git_patch_create [count=1]
  Does all five, in order:
    1. prints the patch
    2. copies it to the clipboard ('copy --raw' — unwrap would corrupt the diff)
    3. saves it to a fresh /tmp/patch-<rand>/<repo>.patch
    4. uploads it to the shared dropbox folder, or says why it could not
    5. sends it to every CODE_SERVER_REMOTE copy-server in the background
       (fire-and-forget; log next to the patch file)
  Examples:
    git_patch_create        last commit
    git_patch_create 3      last 3 commits
  Apply it on the other machine with: git_patch_apply"
    return 1
  fi

  local repo_root
  if ! repo_root=$(git rev-parse --show-toplevel 2> /dev/null); then
    printf '%s\n' "git_patch_create: not a git repository." >&2
    return 1
  fi

  local repo_name
  repo_name="$(basename "$repo_root")"

  local patch_file
  if ! patch_file=$(_git_patch_temp_file "${repo_name}.patch"); then
    printf '%s\n' "git_patch_create: could not create a temp folder." >&2
    return 1
  fi

  if ! _git_patch_write "$patch_file" "${1:-1}"; then
    printf '%s\n' "git_patch_create: could not generate a patch." >&2
    command rm -f "$patch_file"
    return 1
  fi

  if [ "$format" = base64 ] || [ "$format" = base85 ]; then
    local suffix
    [ "$format" = base64 ] && suffix=.b64 || suffix=.b85
    _git_patch_codec "$format" encode "$patch_file" "${patch_file}${suffix}" || return 1
    patch_file="${patch_file}${suffix}"
  fi

  # Never let clipboard formatting alter either the plain diff or its envelope.
  copy --raw "$patch_file" || return 1

  command cat "$patch_file"

  printf '%s\n' ">>> patch copied to clipboard"
  printf '%s\n' ">>> patch file created $patch_file"
  _git_patch_upload "$patch_file" "$repo_name"
  _git_patch_send_to_copy_servers "$patch_file" "$repo_name"
  # cd to the REPO, not to the patch. `git_patch_apply` runs `git apply`, whose
  # paths are repo-relative, so the default "cd to the file's folder" block sent
  # you into the throwaway /tmp patch folder — not a git repo — where every hunk
  # failed with "No such file or directory" and the patch looked corrupt.
  if [ "$format" = base64 ] || [ "$format" = base85 ]; then
    local command_name
    command_name=$(_git_patch_format_name "$format") || return 1
    print_action_summary --run-folder="$repo_root" "$patch_file" "$command_name"
  else
    print_action_summary --run-folder="$repo_root" "$patch_file" git_patch_apply
  fi
}

# git_patch_apply: apply a patch from a file, the clipboard, or the shared folder
function git_patch_apply() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "git_patch_apply: apply a patch from a file, the clipboard, or the shared dropbox folder
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
      printf '%s\n' "git_patch_apply: patch file '$patch_file' not found." >&2
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

  printf '%s\n' ">>> clipboard holds no patch — falling back to the shared dropbox folder"
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

# _git_patch_outcome_line: the single closing line `patch` prints, colored so the
# two outcomes never read alike — green means a patch left this machine, red
# means one landed on it.
function _git_patch_outcome_line() {
  case "${1:-}" in
  copied) printf '\033[0;32m📋 Latest Patch copied to clipboard\033[0m\n' ;;
  applied) printf '\033[0;31m🩹 Patch Applied\033[0m\n' ;;
  esac
}

# _git_patch_unpushed_count: print commits ahead of upstream.
# Returns nonzero when no upstream exists.
function _git_patch_unpushed_count() {
  git rev-list --count '@{upstream}..HEAD' 2> /dev/null
}

# _git_patch_create_unpushed: export commits ahead of upstream in $1 format.
# Defaults to plain; without upstream, warns and exports HEAD. Zero commits is a no-op.
# Returns creation status.
function _git_patch_create_unpushed() {
  local format="${1:-plain}" count
  if count=$(_git_patch_unpushed_count); then
    if [ "$count" -eq 0 ]; then
      printf '%s\n' ">>> no unpushed commits — nothing to create"
      return 0
    fi
    _git_patch_create "$format" "$count"
    return $?
  fi
  printf '\033[0;31m>>> branch has no upstream; generating only the latest commit\033[0m\n' >&2
  _git_patch_create "$format" 1
}

# patch_plain_str: apply a plain patch, otherwise export unpushed commits when present.
# Accepts [-y] [count | patch_file]; application modifies files and can commit.
function patch_plain_str() {
  _git_patch_transfer plain "$@"
}

# patch_64: transfer framed Base64 with a one-line preview; verify before applying.
# Accepts [-y] [count | patch_file]; application modifies files and can commit.
function patch_64() {
  _git_patch_transfer base64 "$@"
}

# patch_85: transfer framed Base85 with a one-line preview; verify before applying.
# Accepts [-y] [count | patch_file]; application modifies files and can commit.
function patch_85() {
  _git_patch_transfer base85 "$@"
}

# `patch` defaults to Base85; explicit Base64 and plain commands remain available.
alias patch='patch_85'

# _git_patch_transfer: shared selection, generation, application, and commit workflow.
# $1 is plain, base64, or base85; remaining args are [-y] [count | patch_file].
# Returns the selected operation's status, including commit failure; rejects damaged input.
# Explicit clipboard acceptance also confirms a single patch, but never bypasses repository checks.
# No patch and zero commits ahead is a successful no-op; clipboard default follows ahead count.
function _git_patch_transfer() {
  local format="$1" name
  name=$(_git_patch_format_name "$format") || return 2
  shift
  if is_help_arg "${1:-}"; then
    printf '%s\n' "$name: apply a patch when one is at hand, otherwise cut a new one
  Usage: $name [-y] [count | patch_file]
  Format: $format. patch aliases patch_85; use patch_64 for Base64 or patch_plain_str for plain diffs.
  Encoded formats wrap version + SHA-256 + original patch bytes; verification precedes apply.
  All formats label each patch with its repository and commit subject.
  Apply accepts complete marked blocks; patch_64 also accepts legacy bare Base64.
  Base64 and Base85 are not encryption or authentication. Plain input is not accepted by encoded modes.
  Options:
    -y, --yes  skip only the clipboard apply prompt; patch and repository prompts remain
  Resolution order:
    1. positive count -> export last N commits, oldest first, with commit boundaries
    2. file -> apply it in this command's format
    3. matching clipboard -> apply by default when synced; otherwise create, unless -y
    4. declined or unrelated clipboard -> export commits ahead of upstream, when any exist
    5. no clipboard patch and zero commits ahead -> do nothing
  Recognized damaged envelopes fail without applying or replacing the clipboard.
  Creation exports committed changes only; staged, unstaged, and untracked work
  stays untouched. Without an upstream, only the latest commit is exported.
  Exports print, copy, save, and upload; encoded files use .patch.b64 or .patch.b85.
  Framed patches ask [quit/n/Y]: Yes applies, No skips, Quit stops.
  A single patch reuses an accepted clipboard prompt; repository checks still ask when needed.
  Files and -y retain per-patch choices. A quit after earlier patches leaves those changes
  uncommitted. After apply, copy the first applied
  commit message (minus Co-authored-by), then run 'git aac'; paste it into the editor.
  This stages all non-ignored work,
  including unrelated new files, and uses git c's hook behavior.
  Examples:
    $name                    offer clipboard apply, else export unpushed commits
    $name -y                 apply matching clipboard without asking
    $name 3                  export the last 3 commits
    $name /tmp/transfer.patch apply an existing file in $format format
  patch shadows /usr/bin/patch — reach the binary with 'command patch'."
    return 1
  fi

  local assume_yes=0 status patch_file confirmation=prompt unpushed_count apply_default apply_prompt
  case "${1:-}" in
  -y | --yes)
    assume_yes=1
    shift
    ;;
  esac

  case "${1:-}" in
  '' | *[!0-9]* | 0) ;;
  *)
    _git_patch_create "$format" "$1"
    status=$?
    [ "$status" -eq 0 ] && _git_patch_outcome_line copied
    return "$status"
    ;;
  esac

  if [ -n "${1:-}" ]; then
    _git_patch_read_file "$format" "$1"
    status=$?
    if [ "$status" -ne 0 ]; then
      if [ "$status" -eq 2 ]; then
        printf '%s\n' "$name: expected a $format patch envelope; use patch_plain_str for plain patches" >&2
      fi
      return 1
    fi
    patch_file="$_GIT_PATCH_INPUT_FILE"
  else
    if ! unpushed_count=$(_git_patch_unpushed_count); then
      unpushed_count=1
    fi

    _git_patch_clipboard_file "$format"
    status=$?
    if [ "$status" -eq 1 ]; then
      return 1
    fi
    if [ "$status" -eq 0 ]; then
      apply_default=N
      [ "$unpushed_count" -eq 0 ] && apply_default=Y
      apply_prompt=$(printf '\033[0;33mClipboard holds a patch that has not been applied here — apply it now?\033[0m')
      if ((assume_yes)) || prompt_yes_no "$apply_prompt" "$apply_default"; then
        patch_file="$_GIT_PATCH_CLIPBOARD_FILE"
        ((assume_yes)) || confirmation=clipboard-confirmed
      else
        printf '%s\n' ">>> leaving the clipboard patch alone — creating patches from unpushed commits instead"
      fi
    else
      printf '%s\n' ">>> clipboard holds no patch — creating patches from unpushed commits instead"
    fi
  fi

  if [ -n "$patch_file" ]; then
    _git_patch_apply_file "$patch_file" "" "$confirmation" || return 1
    if [ "${_GIT_PATCH_APPLIED_PATCH_COUNT:-0}" -eq 0 ]; then
      printf '%s\n' ">>> No patches applied; no commit created"
      return 0
    fi
    _git_patch_commit_applied "$patch_file" || return 1
    _git_patch_outcome_line applied
    return 0
  fi

  if [ "${unpushed_count:-1}" -eq 0 ]; then
    if [ "$status" -eq 2 ]; then
      printf '%s\n' ">>> no clipboard patch and no unpushed commits — nothing to do"
    else
      printf '%s\n' ">>> no unpushed commits — nothing to create"
    fi
    return 0
  fi

  _git_patch_create_unpushed "$format"
  status=$?
  [ "$status" -eq 0 ] && _git_patch_outcome_line copied
  return "$status"
}

################################################################################
# --- Pull Request Inventory ---
# `list_prs` is a standalone Node CLI installed at ~/.local/bin/list_prs by
# software/scripts/git-functions.js (source: software/scripts/git.pr_list.cjs).
# It lists open PRs grouped by how much work each still needs. Flags:
#   --all       include the fully-clear READY TO MERGE group (hidden by default)
#   --me=<0|1>  1 = only yours, 0 = everyone but you, omitted = everyone
#   --cwd       scope to git repos at/below the current folder
#               (--me=1 defaults to a GLOBAL search of every repo you have a PR in;
#               anything wider than yourself implies --cwd, since an unscoped
#               search of everyone's PRs is all of GitHub)
#   --verbose   add the created-at / CI / review metadata line
#   --links     print only the URLs, one per line (paste-clean)
#   --json      the enriched rows as JSON
#   --author=<handle> / --limit=<n> / owner/repo …
#
# The four wrappers below are the named entry points, one per cell of the two
# questions you actually ask: whose PRs (my / other) and how complete a list
# (open = everything, need_attention = only what still owes someone work).
# They are deliberately one line each on top of _pr_list_run, so the guard, the
# help text, and the delegation exist exactly once.
################################################################################

# shared body for the pr_list_* wrappers: guard, help, then delegate to list_prs
function _pr_list_run() {
  local name="$1" me="$2" keep_ready="$3"
  shift 3

  local who="your own" scope_hint="Default scope is a global search of every repo you have a PR in."
  if ! is_truthy "$me"; then
    who="everyone else's"
    scope_hint="Scope defaults to git repos at/below the current folder — pass owner/repo to widen."
  fi
  local completeness="only the PRs that still need something — fully-green, approved, comment-free ones are hidden"
  if is_truthy "$keep_ready"; then
    completeness="every open PR, the ready-to-merge ones included"
  fi

  if is_help_arg "${1:-}"; then
    printf '%s\n' "$name: list $who open PRs, oldest first
  Usage: $name [--cwd] [--verbose] [--links] [--json] [--limit=<n>] [repo ...]
  Lists $completeness.
  $scope_hint
  Pass --me=0 or --me=1 to override whose PRs this wrapper asks for.
  Examples:
    $name
    $name --cwd --verbose
    $name --json acme/api acme/web"
    return 1
  fi

  if ! type -P list_prs > /dev/null 2>&1; then
    printf '%s\n' "$name: list_prs is not installed — run: ./run --files=git-functions.js" >&2
    return 1
  fi

  ## --me / --all go FIRST so a caller-supplied --me=0 still wins: list_prs is
  ## last-wins on --me, and --all is idempotent.
  local lead="--me=$me"
  is_truthy "$keep_ready" && lead="--all $lead"

  ## unquoted on purpose - "lead" is one or two literal flags, never user input
  list_prs $lead "$@"
}

# pr_list_my_open: every open PR of yours, ready-to-merge included
function pr_list_my_open() {
  _pr_list_run "pr_list_my_open" 1 1 "$@"
}

# pr_list_my_need_attention: only your open PRs that still owe someone work
function pr_list_my_need_attention() {
  _pr_list_run "pr_list_my_need_attention" 1 0 "$@"
}

# pr_list_other_open: every open PR someone else authored, ready-to-merge included
function pr_list_other_open() {
  _pr_list_run "pr_list_other_open" 0 1 "$@"
}

# pr_list_other_need_attention: other people's open PRs that still owe someone work
function pr_list_other_need_attention() {
  _pr_list_run "pr_list_other_need_attention" 0 0 "$@"
}

## the bare name is the one you reach for most: everything of mine that is open
alias pr_list='pr_list_my_open'

# pr_merge: validate pull-request URLs, sort WIP last, then enable/disable auto-merge
function pr_merge() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "pr_merge: validate pull-request URLs, sort WIP last, then enable/disable auto-merge
  Usage: pr_merge <url1[,url2...]> [url2 ...]
  Separators: comma, space, tab, pipe, newline
  Stdin: command cat mypr_list | pr_merge
  Prompt: [am] enable auto-merge (default) - [dm] disable auto-merge - [ig] ignore
  Examples:
    pr_merge github.com/acme/api/pull/123, github.com/acme/api/pull/124
    pr_merge 'github.com/acme/api/pull/123
github.com/acme/api/pull/124'"
    return 1
  fi
  if ! type -P pr_merge > /dev/null 2>&1; then
    printf '%s\n' "pr_merge: command is not installed — run: ./run --files=git-functions.js" >&2
    return 1
  fi
  command pr_merge "$@"
}

if type -t add_bookmark > /dev/null 2>&1; then
  # one variadic call, not two - each call costs a fork
  add_bookmark "pr_list_my_open" "pr_merge"
fi
