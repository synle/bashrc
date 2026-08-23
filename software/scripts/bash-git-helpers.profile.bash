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
	remote_url=$(git remote get-url origin 2>/dev/null)
	if [ -z "$remote_url" ]; then
		echo "Error: no git remote found"
		return 1
	fi
	# Normalize to https URL (handles git@, ssh://, and https:// remotes)
	remote_url=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
	echo "$remote_url"
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
		result=$(gh pr view "$number" --repo "$repo_slug" --json url --jq .url 2>/dev/null) || return 1
		printf '%s\n' "$result"
		return 0
	elif [[ "$input" =~ ^([^#]+)#([0-9]+)$ ]]; then
		repo_slug="${BASH_REMATCH[1]}"
		number="${BASH_REMATCH[2]}"
		result=$(gh api -X GET search/issues -f q="is:pr repo:$repo_slug number:$number" --jq '.items[0].html_url' 2>/dev/null) || return 1
		[ -n "$result" ] || return 1
		printf '%s\n' "$result"
		return 0
	else
		echo "pr: invalid reference '$input'" >&2
		return 1
	fi

	remote_url=$(git -C "$repo_folder" remote get-url origin 2>/dev/null) || return 1
	repo_slug=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/||;s|git@github.com:|https://github.com/|;s|https://github.com/||;s|\.git$||')
	repo_slug=$(echo "$repo_slug" | sed 's|.*/\([^/]*\)/\([^/]*\)$|\1/\2|')
	case "$repo_slug" in
	*/*) ;;
	*)
		echo "pr: could not resolve GitHub owner/repo from '$remote_url'" >&2
		return 1
		;;
	esac

	[ -n "$pr_ref" ] || pr_ref=$(git -C "$repo_folder" branch --show-current 2>/dev/null)
	[ -n "$pr_ref" ] || {
		echo "pr: repository has no current branch" >&2
		return 1
	}
	gh pr view "$pr_ref" --repo "$repo_slug" --json url --jq .url 2>/dev/null
}

# Open the current branch PR, or normalize an explicit PR reference.
function pr() {
	if is_help_arg "${1:-}"; then
		echo "pr: open or normalize a pull request reference
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
			echo "pr: could not resolve '$1' to a pull request" >&2
			return 1
		}
		return 0
	fi

	if type -P gh &>/dev/null; then
		gh pr view --web
		return
	fi

	local remote_url
	remote_url=$(git remote get-url origin 2>/dev/null)
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
	default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
	if [ -z "$default_branch" ]; then
		for b in main master; do
			if git rev-parse --verify "origin/$b" >/dev/null 2>&1; then
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

	if type -P git-filter-repo &>/dev/null; then
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
	if is_help_arg "${1:-}"; then
		echo "merge_origin_main_branch: merge origin/<default-branch> into the current branch
  Usage: merge_origin_main_branch
  Aborts any in-progress merge/rebase, fetches, then merges. Default branch is auto-detected."
		return 0
	fi
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
	if is_help_arg "${1:-}"; then
		echo "rebase_origin_main_branch: rebase the current branch onto origin/<default-branch>
  Usage: rebase_origin_main_branch
  Aborts any in-progress merge/rebase, fetches, then rebases. Default branch is auto-detected."
		return 0
	fi
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
# (recover with `git stash list` / `git stash pop`). Deletes untracked *.rej patch rejects; leaves
# every other untracked working-tree file alone. Also sweeps nested .DS_Store Finder junk.
# Also deletes stale local branches (squash-merged PRs), branches fully merged into the default
# branch, local tags that no longer exist on origin, and prunes and removes merged/gone worktrees.
# With --force / -f, every worktree is removed instead, skipping the dirty/merged checks.
function clean() {
	if is_help_arg "${1:-}"; then
		echo "clean: safely reset current branch to origin's default branch
  Usage: clean [--force|-f]
  Notes:
    - Stashes ALL changes (staged + unstaged + untracked) first as a safety backup
    - Recover from stash with: git stash list  |  git stash pop
    - Deletes untracked *.rej files (failed 'git apply' hunk rejects); keeps all other untracked files
    - Deletes nested .DS_Store files (macOS Finder junk)
    - Also deletes stale local branches (squash-merged PRs), merged branches, stale local tags, and prunes and removes merged/gone worktrees
    - --force / -f: ALSO remove EVERY worktree, skipping the dirty/merged checks (uncommitted work in those worktrees is lost)"
		return 1
	fi

	local force_worktrees=0
	case "${1:-}" in
	--force | -f)
		force_worktrees=1
		;;
	esac

	local total_steps=15
	_CLEAN_TOTAL=$total_steps
	_CLEAN_STEP=0

	# Safe stash first: capture staged + unstaged + untracked so nothing is lost.
	# If working tree is already clean (or an in-progress op blocks stash), this is a no-op.
	local stash_msg
	stash_msg="clean backup $(command date +%Y-%m-%d_%H:%M:%S)"
	_clean_log_step "Stashing all changes (staged + unstaged + untracked) as: '$stash_msg' ..."
	git stash push --include-untracked --message "$stash_msg" >/dev/null 2>&1
	echo "  -> recover with: git stash list  |  git stash pop"

	# Soft abort: cancel in-progress merge/rebase/cherry-pick/am WITHOUT 'git clean -fd',
	# so any untracked working-tree files that did not make it into the stash are preserved.
	_clean_log_step "Aborting any in-progress merge/rebase/cherry-pick/am (working tree preserved)..."
	command rm -rf .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null
	git merge --abort 2>/dev/null
	git rebase --abort 2>/dev/null
	git cherry-pick --abort 2>/dev/null
	git am --abort 2>/dev/null

	# Sweep the *.rej hunk rejects a failed 'git apply' / 'patch' leaves behind. They are untracked
	# and gitignored, so they survive every reset below and quietly rot next to the file they failed
	# on. Safe to delete unconditionally: the stash above already captured them.
	_clean_log_step "Removing *.rej patch rejects (failed 'git apply' hunks)..."
	local repo_root
	repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || repo_root="$PWD"
	local rej_files
	rej_files=$(command find "$repo_root" \( -name .git -o -name node_modules \) -prune -o -type f -name '*.rej' -print 2>/dev/null)
	if [ -z "$rej_files" ]; then
		echo "  -> no *.rej files found"
	else
		echo "$rej_files" | while IFS= read -r rej_file; do
			command rm -f "$rej_file"
			echo "  -> removed $rej_file"
		done
		echo "  -> removed $(echo "$rej_files" | command grep -c .) *.rej file(s)"
	fi

	# Sweep macOS Finder junk (.DS_Store) nested anywhere in the repo. Untracked and usually
	# gitignored, so it survives every reset below. Safe to delete unconditionally: the stash
	# above already captured it. .git and node_modules are pruned, same as the *.rej sweep.
	_clean_log_step "Removing nested .DS_Store files (macOS Finder junk)..."
	local ds_store_count
	ds_store_count=$(command find "$repo_root" \( -name .git -o -name node_modules \) -prune -o -type f -name '.DS_Store' -print 2>/dev/null | command grep -c .)
	if [ "${ds_store_count:-0}" -eq 0 ]; then
		echo "  -> no .DS_Store files found"
	else
		command find "$repo_root" \( -name .git -o -name node_modules \) -prune -o -type f -name '.DS_Store' -exec rm -f {} + 2>/dev/null
		echo "  -> removed $ds_store_count .DS_Store file(s)"
	fi

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
	git checkout -b "$temp_branch" >/dev/null 2>&1

	_clean_log_step "Deleting local '$default_branch' (will be re-fetched from origin)..."
	git del "$default_branch" >/dev/null 2>&1

	_clean_log_step "Checking out '$default_branch'..."
	git checkout "$default_branch" >/dev/null 2>&1

	_clean_log_step "Rebasing '$default_branch' onto 'origin/$default_branch'..."
	git rebase "origin/$default_branch" >/dev/null 2>&1

	_clean_log_step "Cleaning up temp backup branch: $temp_branch ..."
	git del "$temp_branch" >/dev/null 2>&1

	_clean_log_step "Deleting stale local branches whose upstream is gone (squash-merged PRs)..."
	git clean-stale-branches

	_clean_log_step "Deleting merged local branches and tags pruned from origin..."
	git clean-merged-branches-and-tags

	if ((force_worktrees)); then
		_clean_log_step "Removing ALL worktrees (--force: dirty/merged checks skipped)..."
		git worktree prune
		worktree_clean --force
	else
		_clean_log_step "Cleaning worktrees (prune + remove merged/gone worktrees)..."
		git clean-worktree
		worktree_clean
	fi

	echo "# ---- Reset to origin/$default_branch (100% done) ----"
	git lastd
}

# Creates an empty commit on a new branch and pushes it to trigger a deployment
function commit_empty_trigger_deploy() {
	if is_help_arg "${1:-}"; then
		echo "commit_empty_trigger_deploy: push an empty commit on a throwaway branch to trigger a deploy
  Usage: commit_empty_trigger_deploy
  Creates branch 'empty-commit-<epoch>', commits --allow-empty, and pushes it to origin."
		return 0
	fi
	local temp_branch_name="empty-commit-$(command date +%s)"
	git checkout -b "$temp_branch_name" >/dev/null 2>&1
	git commit --allow-empty -m "Trigger deployment - EMPTY PR" >/dev/null 2>&1
	git push -u origin "$temp_branch_name" >/dev/null 2>&1
}

# cd to git home directory ($MY_GIT_HOME or ~/git)
function gogit() {
	if is_help_arg "${1:-}"; then
		echo "gogit: cd to git home directory (MY_GIT_HOME or ~/git)
  Usage: gogit [subfolder]"
		return 0
	fi
	local git_home="${MY_GIT_HOME:-$HOME/git}"
	mkdir -p "$git_home" 2>/dev/null
	cd "$git_home"
	if [ -n "${1:-}" ]; then
		cd "$@"
	fi
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
		if ! git ls-remote "$clone_url" &>/dev/null; then
			echo "clone: cannot access '$clone_url'"
			return 1
		fi
	elif [[ "$input" =~ ^[^/]+/[^/]+$ ]]; then
		# Short form: owner/repo — try SSH first, fall back to HTTPS
		local ssh_url="git@github.com:${input}.git"
		local https_url="https://github.com/${input}.git"
		if git ls-remote "$ssh_url" &>/dev/null; then
			clone_url="$ssh_url"
		elif git ls-remote "$https_url" &>/dev/null; then
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
	if is_help_arg "${1:-}"; then
		echo "godownload: cd to the Downloads folder
  Usage: godownload [subfolder]
  Tries \$HOME/Downloads, /mnt/d/Downloads, and on WSL the Windows user Downloads folder."
		return 0
	fi
	local candidates=(
		"$HOME/Downloads"
		"/mnt/d/Downloads"
	)
	# on WSL, try to resolve the Windows user Downloads folder via wslpath
	if type -P wslpath &>/dev/null; then
		local win_home
		win_home="$(wslpath "$(cmd.exe /C 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')" 2>/dev/null)"
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
		echo "git_create_worktree: create or reuse the canonical worktree for a branch, then cd into it
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
		echo "git_create_worktree: a branch name is required (see: git_create_worktree --help)"
		return 1
	fi

	if ! type -P worktree_create >/dev/null 2>&1; then
		echo "git_create_worktree: worktree_create is not installed — run: bash run.sh --files=git-functions.js" >&2
		return 1
	fi

	local target
	target=$(command worktree_create "$1") || return 1

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

# The label `git patch-clean` writes above a commit message, so a patch opened by eye
# says where its message starts. It is readability only — the readers here bound the
# message by the two lines format-patch writes anyway, `Subject:` and a bare `---`, and
# merely skip this line. Every reader matches on this one value instead of repeating the
# literal. The producing side is the `patch-clean` alias in software/scripts/git.gitconfig
# — change the fence there and here in the same edit. Styled as the repo's own
# `# --- Title ---` section marker.
_GIT_PATCH_COMMIT_MSG_FENCE="# --- SY_GIT_PATCH_COMMIT_MSG_FENCE ---"

# _git_patch_temp_file: echo a patch path inside a fresh throwaway folder
function _git_patch_temp_file() {
	# A throwaway mktemp folder gives uniqueness for free — no timestamp, no
	# nested bookkeeping path, and the plain `mktemp -d` retry covers hosts
	# where /tmp is not writable (Termux) via the mktemp polyfill.
	local patch_folder
	patch_folder=$(mktemp -d "/tmp/patch-XXXXXX" 2>/dev/null || mktemp -d) || return 1
	echo "$patch_folder/${1:-patch.patch}"
}

# _git_patch_write: render the last N commits into a patch file (the only generator)
function _git_patch_write() {
	local patch_file="$1"
	# Rendered once into a file, then served to stdout / clipboard / upload from
	# there — a second `git patch-view` run could disagree with what was copied.
	git patch-view "${2:-1}" >"$patch_file" 2>/dev/null && [ -s "$patch_file" ]
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
	paste >"$patch_file" 2>/dev/null

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
	if git apply --check "$patch_file" 2>/dev/null; then
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
	if ! dropbox_folder=$(_dropbox_folder 2>/dev/null); then
		echo ">>> shared dropbox folder not reachable — skipped upload"
		return 0
	fi

	# Same repo-date prefix `git patch-rename` uses, plus the sha so two patches
	# cut in the same minute cannot collide.
	local target
	target="${dropbox_folder}/${repo_name}-$(command date +%Y_%m_%d_%H_%M)-$(git rev-parse --short HEAD 2>/dev/null).patch"
	if command cp "$patch_file" "$target" 2>/dev/null; then
		echo ">>> patch uploaded $target"
		# macOS writes ._ sidecars onto network shares; the reader skips them, but
		# they still clutter the folder for whoever opens it next.
		(type -P dot_clean &>/dev/null && dot_clean "$dropbox_folder" &>/dev/null) &
	else
		echo ">>> could not write $target — skipped upload" >&2
	fi
}

# _git_patch_subject: the commit subject a patch carries, cleaned or not
# `git patch-clean` deliberately empties the `Subject: [PATCH]` header and moves the
# real subject below a `$_GIT_PATCH_COMMIT_MSG_FENCE` fence, which makes `git mailinfo` — and `git am` —
# report no subject at all. Every patch this repo produces goes through that filter, so
# reading the header alone silently commits every transferred patch as "applied patch".
# Try the header first (uncleaned patches, RFC-2047 decoding), then the fence.
function _git_patch_subject() {
	local patch_file="$1"
	[ -f "$patch_file" ] || return 1

	local subject
	subject=$(git mailinfo /dev/null /dev/null <"$patch_file" 2>/dev/null |
		command grep "^Subject: " | sed 's/^Subject: //')
	if [ -n "$subject" ]; then
		echo "$subject"
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

# _git_patch_copy_message: put a patch's commit message on the clipboard, ready to paste
# `copy --raw` is required — unwrap() joins wrapped-looking lines and would collapse a
# multi-line commit body into one paragraph.
function _git_patch_copy_message() {
	local patch_file="$1"

	local message
	message=$(_git_patch_message "$patch_file")
	if [ -z "$message" ]; then
		echo ">>> patch carries no fenced commit message — clipboard left alone" >&2
		return 1
	fi

	printf '%s\n' "$message" | copy --raw
	echo ">>> commit message copied to clipboard:"
	printf '%s\n' "$message"
}

# _git_patch_commit_applied: the post-apply half of `patch` — message to clipboard, then commit
# `git add -u` on purpose: a patch only ever touches files it already knows about, and
# -A would sweep in whatever else the tree was holding. The commit is left interactive so
# the message can be pasted (and edited) rather than committed blind.
function _git_patch_commit_applied() {
	local patch_file="$1"

	_git_patch_copy_message "$patch_file"
	echo ">>> staging tracked changes and committing — paste the message in the editor"
	git add -u && git commit
}

# _git_patch_apply_from_dropbox: apply the newest shared patch, then commit and archive it
function _git_patch_apply_from_dropbox() {
	local dropbox_folder
	if ! dropbox_folder=$(_dropbox_folder 2>/dev/null); then
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
	IFS= read -r -d '' find_patch_js <<'_PATCH_FIND_EOF_' || true
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

	# Decoded commit subject from the patch itself (handles both the RFC-2047 header
	# and the `$_GIT_PATCH_COMMIT_MSG_FENCE` fence patch-clean leaves behind), so the commit lands on
	# this machine under the message it was authored with.
	local commit_msg
	commit_msg=$(_git_patch_subject "$latest_patch")
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
	git commit --amend --reset-author --no-edit --no-verify >/dev/null ||
		echo ">>> could not reset the commit author — commit kept as authored" >&2
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
	if ! repo_root=$(git rev-parse --show-toplevel 2>/dev/null); then
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
	# cd to the REPO, not to the patch. `git_patch_apply` runs `git apply`, whose
	# paths are repo-relative, so the default "cd to the file's folder" block sent
	# you into the throwaway /tmp patch folder — not a git repo — where every hunk
	# failed with "No such file or directory" and the patch looked corrupt.
	print_action_summary --run-folder="$repo_root" "$patch_file" git_patch_apply
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

# _git_patch_outcome_line: the single closing line `patch` prints, colored so the
# two outcomes never read alike — green means a patch left this machine, red
# means one landed on it.
function _git_patch_outcome_line() {
	case "${1:-}" in
	copied) printf '\033[0;32m📋 Latest Patch copied to clipboard\033[0m\n' ;;
	applied) printf '\033[0;31m🩹 Patch Applied\033[0m\n' ;;
	esac
}

# patch: one word for the whole transfer pair — apply when there is something to
# apply, otherwise cut a fresh patch. This shadows /usr/bin/patch in shells that
# load the profile; reach the binary with `command patch`.
function patch() {
	if is_help_arg "${1:-}"; then
		echo "patch: apply a patch when one is at hand, otherwise cut a new one
  Usage: patch [patch_file]
  Resolution order:
    1. <patch_file>, when given       -> git_patch_apply <patch_file>
    2. clipboard reads like a diff    -> asks first, then applies it
    3. declined, empty, or not a diff -> git_patch_create (export the last commit)
  After a successful apply it copies the patch's own commit message (minus any
  Co-authored-by trailer) to the clipboard, then runs 'git add -u && git commit'
  so the message can be pasted straight into the editor.
  Examples:
    patch                  offer to apply the clipboard diff, else export the last commit
    patch /tmp/fix.patch   apply an existing patch file
  Shadows /usr/bin/patch — reach the binary with 'command patch'."
		return 1
	fi

	local status

	if [ -n "${1:-}" ]; then
		git_patch_apply "$@"
		status=$?
		if [ "$status" -eq 0 ]; then
			_git_patch_commit_applied "$1"
			_git_patch_outcome_line applied
		fi
		return "$status"
	fi

	# Ask before applying: a clipboard diff is often something you just cut and
	# want to send, not something to land here. Declining falls through to cutting
	# a fresh patch, same as an empty clipboard.
	if _git_patch_clipboard_file; then
		if prompt_yes_no "Clipboard holds a patch that has not been applied here — apply it now?" Y; then
			_git_patch_apply_file "$_GIT_PATCH_CLIPBOARD_FILE"
			status=$?
			if [ "$status" -eq 0 ]; then
				_git_patch_commit_applied "$_GIT_PATCH_CLIPBOARD_FILE"
				_git_patch_outcome_line applied
			fi
			return "$status"
		fi
		echo ">>> leaving the clipboard patch alone — creating one from the last commit instead"
	else
		echo ">>> clipboard holds no patch — creating one from the last commit instead"
	fi

	git_patch_create
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
		echo "$name: list $who open PRs, oldest first
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

	if ! type -P list_prs >/dev/null 2>&1; then
		echo "$name: list_prs is not installed — run: bash run.sh --files=git-functions.js" >&2
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
		echo "pr_merge: validate pull-request URLs, sort WIP last, then enable/disable auto-merge
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
	if ! type -P pr_merge >/dev/null 2>&1; then
		echo "pr_merge: command is not installed — run: bash run.sh --files=git-functions.js" >&2
		return 1
	fi
	command pr_merge "$@"
}

if type -t add_bookmark >/dev/null 2>&1; then
	# one variadic call, not two - each call costs a fork
	add_bookmark "pr_list_my_open" "pr_merge"
fi
