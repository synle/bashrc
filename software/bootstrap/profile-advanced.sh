#!/usr/bin/env bash

# software/bootstrap/profile-advanced.sh
################################################################################
# ---- Early Profile Blocks (registerWithBashSyleProfile) ----
################################################################################

################################################################################
# ---- History ----
#
# HISTCONTROL is intentionally NOT 'ignoreboth' (= ignorespace + ignoredups).
# 'ignoredups' silently drops a command when it's identical to the immediately
# previous in-history entry. In test/iteration workflows where the user reruns
# the same command minutes apart with nothing else between them in this shell
# (typing into a chat/IDE in between counts as nothing for bash), the rerun
# gets eaten — never appears in `history`, never written to ~/.bash_history,
# never visible in fuzzy_history (Ctrl+R). We use 'erasedups' instead: every
# run gets added; older identical entries are then erased, leaving exactly
# one entry at the most-recent run position. That's what Ctrl+R users expect.
# 'ignorespace' is kept so a leading space still suppresses sensitive commands.
# See docs/bash-common-knowledge.md → "Bash History" for the full write-up.
################################################################################
export HISTSIZE=80000
export HISTFILESIZE=80000
export HISTTIMEFORMAT="[%F %T] "
export HISTCONTROL=ignorespace:erasedups
shopt -s histappend 2> /dev/null              # append instead of overwrite history file
shopt -s cmdhist 2> /dev/null                 # save multi-line commands as one entry
shopt -s cdspell 2> /dev/null                 # auto-correct minor typos in cd directory names
shopt -s checkwinsize 2> /dev/null            # update LINES and COLUMNS after each command
shopt -s no_empty_cmd_completion 2> /dev/null # skip searching all commands when tab is pressed on empty line
# bash 4+ only — silently ignored on older shells
shopt -s autocd 2> /dev/null   # type a directory name to cd into it
shopt -s globstar 2> /dev/null # enable recursive globbing with ** (e.g. ls **/*.js)
shopt -s dirspell 2> /dev/null # auto-correct directory typos during tab completion

ignored_history=(
  # Most former entries (length-based filters for 1-4 char commands, and explicit
  # `git xxx`/`n xxx`/`y xxx`/`yarn xxx` patterns) were removed: they suppressed
  # the very commands the user types most. _rewrite_last_history (defined below)
  # canonicalizes shorthand → canonical form (g→git, n→npm, d→docker, plus simple
  # git aliases), and HISTCONTROL=erasedups then collapses repeats. The result
  # is a history of canonical commands, deduped, with no "interesting" ones lost.
  # Only entries left here are truly noise-with-no-canonical-form.
  "clear"
  "clean"
  "history"
  "fuzzy_*"
  "pip install*"
  "pip3 install*"
  "uv pip install*"
)
export HISTIGNORE=$(
  IFS=":"
  echo "${ignored_history[*]}"
)
unset ignored_history

# Canonicalize a command: expand short (≤2 char) aliases via BASH_ALIASES and
# strip marker commands (clear, clean, br) that are noise in compound commands.
# usage: _canonicalize_command "command string"
# echoes the canonicalized command; original if unchanged; empty if stripped bare.
function _canonicalize_command() {
  local cmd="$1" first expansion

  # First-word alias expansion: any ≤2-char alias resolves to its target via
  # the BASH_ALIASES associative array (populated by bash in interactive shells).
  first="${cmd%% *}"
  if [ ${#first} -le 2 ] && [ -n "${BASH_ALIASES[$first]+_}" ]; then
    expansion="${BASH_ALIASES[$first]}"
    if [ "$first" = "$cmd" ]; then
      cmd="$expansion"
    else
      cmd="$expansion ${cmd#"$first "}"
    fi
  fi

  # Strip marker commands that add noise in compound commands.
  # Matches: `clear ; git status` → `git status`, `git status ; clear` → `git status`,
  # `; clear ; git status` → `git status`, `clear && clean && git status` → `git status`.
  local _HISTORY_MARKER_COMMANDS='clear|clean|br'
  while true; do
    if [[ "$cmd" =~ ^(;\ )?(${_HISTORY_MARKER_COMMANDS})(\ ;\ |\ \&\& )(.*)$ ]]; then
      cmd="${BASH_REMATCH[4]}"
      continue
    fi
    if [[ "$cmd" =~ ^(.*)(\ ;\ |\ \&\& )(${_HISTORY_MARKER_COMMANDS})(;\ )?$ ]]; then
      cmd="${BASH_REMATCH[1]}"
      continue
    fi
    break
  done

  echo "$cmd"
}

# Rewrite the last history entry to a canonical form via _canonicalize_command.
# Combined with HISTCONTROL=erasedups, this gives a deduped history of canonical
# commands — `g status` and `git status` converge to one `git status` entry.
# Runs via PROMPT_COMMAND after every command; idempotent and skipped on
# bare-Enter (no new history entry).
_rewrite_last_history() {
  local hline hnum last rest new
  hline=$(builtin history 1) || return 0
  hline="${hline#"${hline%%[![:space:]]*}"}"
  hnum="${hline%%[^0-9]*}"
  [ -z "$hnum" ] && return 0
  rest="${hline#"$hnum"}"
  rest="${rest#"${rest%%[![:space:]]*}"}"
  if [[ "$rest" == \[*\]* ]]; then
    rest="${rest#*] }"
  fi
  last="$rest"

  [ "$hnum" = "${_LAST_REWRITE_HNUM:-}" ] && return 0
  _LAST_REWRITE_HNUM=$hnum

  new=$(_canonicalize_command "$last")
  [ -z "$new" ] && return 0
  [ "$new" = "$last" ] && return 0

  builtin history -d "$hnum"
  builtin history -s "$new"
}

# Rewrite the entire history file: canonicalize every entry and dedup (keeping
# most recent per canonical command). Uses _canonicalize_command for alias
# expansion and marker stripping. Reloads in-memory history from disk after.
# Safe to call at any time — preserves timestamps; only COMMANDS change.
function _rewrite_history_file() {
  local histfile="${HISTFILE:-$HOME/.bash_history}"
  [ -f "$histfile" ] || return 0

  local tmp=$(mktemp)
  local ts="" cmd="" canonical=""

  # Phase 1: canonicalize every entry, preserve timestamps
  while IFS= read -r line; do
    if [[ "$line" == \#* ]]; then
      ts="$line"
    else
      canonical=$(_canonicalize_command "$line")
      if [ -n "$canonical" ]; then
        echo "${ts:-}"
        echo "$canonical"
      fi
      ts=""
    fi
  done < "$histfile" > "$tmp"

  # Phase 2: dedup pairs keeping last occurrence per command (most recent wins)
  local deduped=$(mktemp)
  perl -e '
    my @lines = <>;
    my (%seen, @out);
    for (my $i = $#lines; $i >= 1; $i -= 2) {
      my $cmd = $lines[$i];
      my $ts  = $lines[$i-1];
      chomp $cmd;
      chomp $ts;
      next unless $cmd;
      next if $seen{$cmd};
      $seen{$cmd} = 1;
      if ($ts ne "") {
        unshift @out, "$ts\n$cmd\n";
      } else {
        unshift @out, "$cmd\n";
      }
    }
    print @out;
  ' "$tmp" > "$deduped"

  if ! cmp -s "$histfile" "$deduped" 2> /dev/null; then
    command cat "$deduped" > "$histfile"
    builtin history -r
  fi

  rm -f "$tmp" "$deduped"
}

# prune a recents file, removing entries that fail the given test (-d or -f)
# usage: _prune_recents <file> <test_flag>
function _prune_recents() {
  local file="$1" flag="$2" tmp="$1.tmp"
  touch "$file"
  while IFS= read -r entry; do
    [ "$flag" "$entry" ] && echo "$entry"
  done < "$file" 2> /dev/null > "$tmp"
  mv "$tmp" "$file"
}

# prepend stdin lines to a recents file (deduped, capped at max)
# usage: echo "entry" | _prepend_recents <file> <max>
function _prepend_recents() {
  local file="$1" max="$2" tmp="$1.tmp"
  command cat - "$file" 2> /dev/null | awk '!seen[$0]++' | head -n "$max" > "$tmp"
  mv "$tmp" "$file"
}

################################################################################
# ---- Track Visited Directories ----
# Maintains a list of recently visited directories in
# _RECENT_FOLDERS_FILE. The list is capped at _RECENT_FOLDERS_MAX
# entries, most recent first, deduplicated, and auto-pruned
# of directories that no longer exist.
#
# Used by:
#   _track_folder - runs via PROMPT_COMMAND after every command
#   _recent_folders - reads and cleans the folders file
#   last_folder - cd to the most recently visited directory
#   fuzzy_cd - fzf cd picker for directories
################################################################################
_RECENT_FOLDERS_FILE=~/.bash_syle_paths
_RECENT_FOLDERS_MAX=100

# reads the folders file, removes entries that no longer exist, and outputs the cleaned list
function _recent_folders() {
  _prune_recents "$_RECENT_FOLDERS_FILE" -d
  command cat "$_RECENT_FOLDERS_FILE"
}

# prepends the current directory to the folders file (deduped, capped at _RECENT_FOLDERS_MAX)
# skips home directory. runs automatically via PROMPT_COMMAND.
function _track_folder() {
  local current="$(pwd)"
  [ "$current" = "$HOME" ] && return
  echo "$current" | _prepend_recents "$_RECENT_FOLDERS_FILE" "$_RECENT_FOLDERS_MAX"
}

# cd to the most recently visited directory
function last_folder() {
  local dir
  dir=$(_recent_folders | head -1)
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    cd "$dir"
  else
    echo "last_folder: no valid folder found"
  fi
}

# Ghostty's bash shell-integration script (loaded before this profile) reads
# `$GHOSTTY_SHELL_FEATURES` inside its __ghostty_precmd hook and injects
# behavior per listed feature: "cursor" appends `\[\e[5 q\]` (blinking bar)
# to PS1; "title" writes its own OSC 0/2 title (the last-run command name,
# producing tab titles like "clean", "open .", "ckeab" instead of the pwd
# we want). Existing shells keep whatever feature list they inherited at
# spawn time even after `shell-integration-features` is edited in the
# ghostty config — so strip the offending features here defensively, making
# the precmd hooks no-ops and letting our block-cursor + PROMPT_COMMAND
# OSC 0 (shorter_pwd_path) stick.
if [ -n "${GHOSTTY_SHELL_FEATURES:-}" ]; then
  export GHOSTTY_SHELL_FEATURES="${GHOSTTY_SHELL_FEATURES//cursor/}"
  export GHOSTTY_SHELL_FEATURES="${GHOSTTY_SHELL_FEATURES//title/}"
fi

# append history to file after every command (but do NOT clear+reload with -c/-r,
# so Up arrow navigates current tab's session history instead of showing commands
# from other tabs. Ctrl+R / fuzzy_history search the shared file for cross-tab history)
# Also force the terminal cursor back to a steady (non-blinking) block via
# DECSCUSR `\e[2 q` on every prompt — defends against shell integrations,
# plugins, or stray escape sequences that flip the cursor to a bar/beam.
PROMPT_COMMAND="_rewrite_last_history; _track_folder; history -a; echo -ne '\033]0;'\"\$(shorter_pwd_path)\"'\007\033[2 q'${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

################################################################################
# ---- Track Recent Files ----
# Maintains a list of recently opened files in
# _RECENT_FILES_FILE. The list is capped at _RECENT_FILES_MAX
# entries, most recent first, deduplicated, and auto-pruned
# of files that no longer exist.
#
# Used by:
#   _track_file - called by editor wrappers (vim, subl, zed, code)
#   _recent_files - reads and cleans the files list
#   last_file - open the most recently opened file
#   fuzzy_recent_files - fzf picker for recently opened files
################################################################################
_RECENT_FILES_FILE=~/.bash_syle_recent_files
_RECENT_FILES_MAX=100

# reads the files list, removes entries that no longer exist, and outputs the cleaned list
function _recent_files() {
  _prune_recents "$_RECENT_FILES_FILE" -f
  command cat "$_RECENT_FILES_FILE"
}

# prepends the given file path(s) to the recent files list (deduped, capped at _RECENT_FILES_MAX)
function _track_file() {
  for arg in "$@"; do
    [ -f "$arg" ] || continue
    local full
    full=$(realpath "$arg" 2> /dev/null) || continue
    echo "$full"
  done | _prepend_recents "$_RECENT_FILES_FILE" "$_RECENT_FILES_MAX"
}

# open the most recently opened file with view_file
function last_file() {
  local f
  f=$(_recent_files | head -1)
  if [ -n "$f" ] && [ -f "$f" ]; then
    view_file "$f"
  else
    echo "last_file: no valid file found"
  fi
}

################################################################################
# ---- Autocomplete Filters ----
################################################################################
ignored_commands=(
  "*/CleanPCCSP*"
  "*/cleanmgr*"
  "*/clean-staging*"
  "*/clear_console*"
  "*/clear"
)
ignored_files=(
  ".rej"
  ".pyc"
  ".tmp"
  ".DS_Store"
)
cmd_string=$(printf ":%s" "${ignored_commands[@]}")
file_string=$(printf ":%s" "${ignored_files[@]}")
export EXECIGNORE="$EXECIGNORE${cmd_string}"
export FIGNORE="$FIGNORE${file_string}"
unset ignored_commands cmd_string ignored_files file_string

################################################################################
# ---- Shell Utilities ----
################################################################################
# find all existing paths from a list of candidates (supports wildcards)
function find_path_list() {
  if is_help_arg "${1:-}"; then
    echo "
      find_path_list: find all existing paths from a list of candidates
        find_path_list path1 path2 ...                any existing paths (default)
        find_path_list path1 path2 ... --file       all existing files
        find_path_list path1 path2 ... --folder     all existing directories
        find_path_list path1 path2 ... --exec       all executable binaries
        find_path_list path1 path2 ... --any        any existing paths (explicit)
        Candidates can be passed inline or via an array:
          local candidates=(\"/path/a\" \"/path/b\")
          find_path_list \"\${candidates[@]}\" --folder
        Wildcards are supported (quoted to prevent premature expansion):
          find_path_list '/mnt/z/drop*' --folder      skipped if ambiguous
          find_path_list '/usr/bin/vim*' --exec       all executable matches
    "
    return 0
  fi

  local args=("$@") mode="any"
  local last="${args[-1]}"
  if [[ "$last" == "--file" || "$last" == "--folder" || "$last" == "--exec" || "$last" == "--any" ]]; then
    mode="${last#--}"
    unset 'args[-1]'
  fi
  local found=0
  # enable nullglob so unmatched globs expand to nothing instead of the
  # literal pattern string (e.g. /mnt/z/drop* becomes empty, not tested as-is)
  shopt -s nullglob
  for pattern in "${args[@]}"; do
    local matches=($pattern) # unquoted — allows glob expansion
    if [[ "$mode" == "exec" ]]; then
      # exec mode: iterate all glob matches to find executables
      for p in "${matches[@]}"; do
        [[ -x "$p" ]] && echo "$p" && found=1
      done
    else
      # file/folder/any mode: skip ambiguous wildcards (multiple matches)
      [ "${#matches[@]}" -eq 1 ] || continue
      local p="${matches[0]}"
      case "$mode" in
      file) [ -f "$p" ] && echo "$p" && found=1 ;;
      folder) [ -d "$p" ] && echo "$p" && found=1 ;;
      *) [ -e "$p" ] && echo "$p" && found=1 ;;
      esac
    fi
  done
  shopt -u nullglob # restore default glob behavior
  ((found)) && return 0 || return 1
}

# find first existing path from a list of candidates (delegates to find_path_list)
function find_path() {
  if is_help_arg "${1:-}"; then
    echo "
      find_path: find first existing path from a list of candidates
        find_path path1 path2 ...                any existing path (default)
        find_path path1 path2 ... --file       first existing file
        find_path path1 path2 ... --folder     first existing directory
        find_path path1 path2 ... --exec       first executable binary
        find_path path1 path2 ... --any        any existing path (explicit)
        Candidates can be passed inline or via an array:
          local candidates=(\"/path/a\" \"/path/b\")
          find_path \"\${candidates[@]}\" --folder
        Wildcards are supported (quoted to prevent premature expansion):
          find_path '/mnt/z/drop*' --folder      skipped if ambiguous
          find_path '/usr/bin/vim*' --exec       first executable match
    "
    return 0
  fi

  local result
  result=$(find_path_list "$@" | head -1)
  [[ -n "$result" ]] && echo "$result" && return 0
  return 1
}

# @deprecated Use find_path instead.
function find_existing() {
  find_path "$@"
}

# checks if a value is truthy (1, true, y, yes — case-insensitive)
function is_truthy() {
  if is_help_arg "${1:-}"; then
    echo "
      is_truthy: check if a value is truthy (1, true, y, yes — case-insensitive)
        is_truthy 1           returns 0 (success)
        is_truthy yes         returns 0 (success)
        is_truthy false       returns 1 (failure)
        is_truthy \"\${1:-}\" && do_something
    "
    return 0
  fi
  case "${1,,}" in 1 | true | y | yes) return 0 ;; *) return 1 ;; esac
}

# prompts the user with a yes/no question (default no)
# Mirror of the same function in software/bootstrap/common-functions.bash —
# keep in sync. Profile partials cannot SOURCE common-functions.bash because
# the profile is loaded on every interactive shell startup and we want to
# keep it lean, so the function is duplicated here.
function prompt_yes_no() {
  if is_help_arg "${1:-}"; then
    echo "
      prompt_yes_no: prompt the user with a yes/no question
        Usage: prompt_yes_no <prompt> [default]
        default: 'Y' or 'N' (case-insensitive); defaults to 'N'.
        Returns 0 on yes; 1 on no / empty / no-tty.
        Example: prompt_yes_no 'Continue?' && do_thing
        Example: prompt_yes_no 'Skip step?' Y && skip_step
    "
    return 0
  fi
  local prompt="$1"
  local default="${2:-N}"
  local hint="[y/N]"
  case "$default" in [Yy]*) hint="[Y/n]" ;; esac

  # Probe /dev/tty by actually opening it. `[ -r /dev/tty ]` lies — the
  # device node always exists, but open() returns ENXIO when the process has
  # no controlling terminal (CI, daemons, piped shells).
  (: < /dev/tty) 2> /dev/null || return 1

  local reply=""
  read -rp "$prompt $hint " reply < /dev/tty
  reply="$(echo "$reply" | tr '[:lower:]' '[:upper:]' | xargs)"

  if [ -z "$reply" ]; then
    case "$default" in [Yy]*) return 0 ;; esac
    return 1
  fi

  case "$reply" in Y | YES) return 0 ;; esac
  return 1
}

################################################################################
# ---- HTTP / Networking Utilities ----
################################################################################
# curl drop-in: pretty-prints JSON responses via jq when available
function curl() {
  if is_help_arg "${1:-}"; then
    echo "
      curl: drop-in curl wrapper that pretty-prints JSON responses via jq
        curl <url> [flags...]    standard curl; auto-formats JSON when applicable
        Falls back to plain \`command curl\` when:
          - jq is not installed
          - stdout is not a TTY (i.e. piped or redirected — preserves streaming)
          - any output-redirect / download flag is present
            (-o, -O, -J, --remote-name-all, -i, -I, -D, -T, -w, --output-dir)
          - the response is not JSON
    "
    return 0
  fi

  # No jq installed → straight pass-through.
  type -P jq &> /dev/null || {
    command curl "$@"
    return
  }

  # stdout is not a TTY (caller is piping or redirecting) → don't intercept.
  # Preserves streaming for `curl URL | tar xz`, `curl URL | bash`, `curl URL > file`, etc.
  [ -t 1 ] || {
    command curl "$@"
    return
  }

  # Caller manages output → don't intercept.
  local arg
  for arg in "$@"; do
    case "$arg" in
    -o | --output | -O | --remote-name | --remote-name-all | \
      -J | --remote-header-name | \
      -i | --include | -I | --head | \
      -D | --dump-header | -T | --upload-file | \
      -w | --write-out | --output-dir)
      command curl "$@"
      return
      ;;
    esac
  done

  local tmpdir
  tmpdir=$(mktemp -d) || {
    command curl "$@"
    return
  }
  trap 'rm -rf "$tmpdir"' RETURN

  command curl "$@" -D "$tmpdir/headers" -o "$tmpdir/body" || return

  # Use `tail -1` so the FINAL response's Content-Type wins after redirects
  # (-D dumps every hop's headers; the first hop is usually text/html for 30x).
  local content_type
  content_type=$(grep -i '^content-type:' "$tmpdir/headers" | tail -1 | tr -d '\r' | sed 's/.*://' | tr '[:upper:]' '[:lower:]')

  if [[ "$content_type" == *json* ]] && jq -e . "$tmpdir/body" &> /dev/null; then
    jq . "$tmpdir/body"
  else
    command cat "$tmpdir/body"
  fi
}

################################################################################
# ---- Aliases: Navigation ----
################################################################################
alias ..="cd .."
alias ...="cd ../../"
alias ....="cd ../../../"
alias clear='printf "\033[H\033[2J"'

# ---- cd (plain wrapper, zoxide override appended later by starship-config.js) ----
function cd() {
  command cd "$@"
}

# ---- Aliases: File Listing (eza override) ----
if type -P eza &> /dev/null; then
  function ls() { command eza -1 -F --color=always "$@"; }
  alias ll="ls -lah --git"
  alias ls_newest="ll --sort=modified"         # sort by modification time (newest first)
  alias ls_newest_last="ls_newest --reverse"   # sort by modification time (oldest first)
  alias ls_biggest="ll --sort=size"            # sort by file size (biggest first)
  alias ls_biggest_last="ls_biggest --reverse" # sort by file size (smallest first)
fi

# ---- find (fd wrapper) ----
# `fd` is guaranteed on PATH by ensure_binary_alias (apt's fd-find installs as
# fdfind; we symlink $HOME/.local/bin/fd). Other distros ship `fd` directly.
type -P fd &> /dev/null && alias f='fd'

# ---- Aliases: Editors / Tools ----
alias bs="bash"
alias vi="vim"
alias v="vim"
alias c="command cat"
# ---- Aliases: Git ----
# git wrapper: invalidates branch cache on state-changing commands
function git() {
  command git "$@"
  local _git_exit=$?
  case "${1-}" in
  # core commands
  checkout | switch | pull | push | fetch | merge | rebase | commit | reset | stash | cherry-pick | revert | am | apply)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: commit (c, cm, amend, wip, unwip)
  c | cm | amend | amendm | wip | unwip)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: checkout/branch (co, cob, del, gone)
  co | cob | del | gone)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: pull/push/fetch (p, pu, po, pof, fap, fapr, track)
  p | pu | po | pof | fap | fapr | track)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: rebase/merge/revert (r, rc, ri, rv, rvc, mc, cp, cpc, cpn)
  r | rc | ri | rv | rvc | mc | cp | cpc | cpn)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: undo/cleanup (undo, cleanfd, patch)
  undo | cleanfd | patch)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: status/branch/log/diff info
  s | stat | status | b | ba | del | branch | d | ds | dh | diff | l | ll | ls | lls | log)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  esac
  return $_git_exit
}
alias g="git"
alias gg="git --no-pager"

# ---- Aliases: Node ----
alias n="node"
alias y="yarn"
alias a_node="activate_node"

# ---- Aliases: Python ----
alias a_py="activate_py"
alias pytest="python -m pytest"
alias pytest-single="python -m pytest -vvl -k"
alias flake="flake8"
alias flake8="python -m flake8"

# ---- Aliases: Git ----
alias stash="git stash"
alias pop="git stash pop"
alias amend="git amend"

# ---- Aliases: Claude ----
# SOURCE | software/scripts/advanced/llm/claude/claude.profile.bash

# ---- Aliases: OpenCode ----
# SOURCE | software/scripts/advanced/llm/opencode/opencode.profile.bash

# ---- Ollama Performance ----
# SOURCE | software/scripts/advanced/llm/ollama.profile.bash

# ---- Aliases: Copilot ----
# SOURCE | software/scripts/advanced/llm/copilot/copilot.profile.bash

# ---- Aliases: Gemini ----
# SOURCE | software/scripts/advanced/llm/gemini/gemini.profile.bash

# ---- Aliases: SSH ----
alias s="ssh"

################################################################################
# ---- Utility Functions ----
################################################################################
function pwd2() {
  print_action_summary "."
}

# to_windows_path / print_action_summary live in profile-core.sh so they are
# guaranteed available before any partial sourced via SOURCE markers tries to call
# them (view_file in bash-fzf, run_editor in editor-launchers).

################################################################################
# ---- Diff (file diff or git hash compare) ----
################################################################################
# smart diff for files or git commits
function diff() {
  if is_help_arg "${1:-}"; then
    echo "
      diff: smart diff for files or git commits
        diff file1 file2       side-by-side diff (VS Code if available)
        diff abc123 def456     git diff between two commit hashes
        diff <flags> <files>   forward to /usr/bin/diff
        diff help              show this help
    "
    return
  fi
  if [ $# -ne 2 ]; then
    command diff -w --color -y --suppress-common-lines "$@"
    return
  fi

  local file1_valid=false file2_valid=false
  [ -f "$1" ] && file1_valid=true
  [ -f "$2" ] && file2_valid=true

  # both files exist — diff them
  if $file1_valid && $file2_valid; then
    if type -P code &> /dev/null; then
      code --diff "$1" "$2"
    else
      command diff -w --color -y --suppress-common-lines "$1" "$2"
    fi
    return
  fi

  # one file exists, one doesn't
  if $file1_valid && ! $file2_valid; then
    echo "File not found: $2"
    return 1
  fi
  if ! $file1_valid && $file2_valid; then
    echo "File not found: $1"
    return 1
  fi

  # neither file exists — check if they look like git hashes
  local hash_re='^[a-f0-9]{4,40}$'
  local hash1_valid=false hash2_valid=false
  if [[ "$1" =~ $hash_re ]] && git rev-parse --verify "$1" &> /dev/null; then
    hash1_valid=true
  fi
  if [[ "$2" =~ $hash_re ]] && git rev-parse --verify "$2" &> /dev/null; then
    hash2_valid=true
  fi

  if $hash1_valid && $hash2_valid; then
    echo "git diff $1 $2"
    git diff "$1" "$2"

    # open github compare if remote is available
    local repo_url
    repo_url=$(git config --get remote.origin.url 2> /dev/null)
    if [ -n "$repo_url" ]; then
      repo_url="${repo_url#*:}"
      repo_url="${repo_url%.git}"
      repo_url="${repo_url#*github.com/}"
      local compare_url="https://github.com/${repo_url}/compare/${1}...${2}"
      echo "$compare_url"
      open "$compare_url"
    fi
    return
  fi

  # partial match — tell user which is invalid
  if ! $hash1_valid && ! $file1_valid; then
    echo "File or hash not found: $1"
  fi
  if ! $hash2_valid && ! $file2_valid; then
    echo "File or hash not found: $2"
  fi
  return 1
}

################################################################################
# ---- Git Helpers ----
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

  local owner="${1:-synle}"
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

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    echo "Error: no git remote found"
    return 1
  fi
  # Normalize to https URL (handles git@, ssh://, and https:// remotes)
  remote_url=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  local branch
  branch=$(git branch --show-current)
  local pr_url="$remote_url/pull/$branch"
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

# Purges a file or directory (-r) from entire git history, rewrites all commits, and force-pushes
function purge() {
  local recursive=""
  if [ "$1" = "-r" ]; then
    recursive="-r"
    shift
  fi

  local file_path="$1"
  if [ -z "$file_path" ] || is_help_arg "$file_path"; then
    echo "
      purge: remove a file or directory from entire git history
        Usage: purge [-r] <path-to-file-or-dir>
    "
    return 1
  fi

  if ! prompt_yes_no "Purge '$file_path' from entire git history?"; then
    echo ">> Aborted."
    return 1
  fi

  echo ">> Purging '$file_path' from git history..."
  git filter-branch --force \
    --index-filter "git rm $recursive --cached --ignore-unmatch $file_path" \
    --prune-empty \
    --tag-name-filter cat \
    -- --all

  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
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

  echo "# ---- Rebased $(git branch --show-current) onto origin/$default_branch ----"
  git lastd
}

# Safely resets the current branch to origin's default branch.
# Stashes ALL changes (staged + unstaged + untracked) first as a safety backup so nothing is lost
# (recover with `git stash list` / `git stash pop`). Does NOT delete untracked working-tree files.
# Also deletes stale local branches (squash-merged PRs) and prunes stale worktrees.
function clean() {
  if is_help_arg "${1:-}"; then
    echo "clean: safely reset current branch to origin's default branch
  Usage: clean
  Notes:
    - Stashes ALL changes (staged + unstaged + untracked) first as a safety backup
    - Recover from stash with: git stash list  |  git stash pop
    - Does NOT delete untracked working-tree files
    - Also deletes stale local branches (squash-merged PRs) and prunes stale worktrees"
    return 1
  fi

  local total_steps=11
  local current_step=0

  function _log_step() {
    current_step=$((current_step + 1))
    local remaining=$((total_steps - current_step))
    local percent=$((current_step * 100 / total_steps))
    echo "[Step $current_step/$total_steps - ${percent}% done, $remaining left] $1"
  }

  # Safe stash first: capture staged + unstaged + untracked so nothing is lost.
  # If working tree is already clean (or an in-progress op blocks stash), this is a no-op.
  local stash_msg
  stash_msg="clean backup $(command date +%Y-%m-%d_%H:%M:%S)"
  _log_step "Stashing all changes (staged + unstaged + untracked) as: '$stash_msg' ..."
  git stash push --include-untracked --message "$stash_msg" > /dev/null 2>&1
  echo "  -> recover with: git stash list  |  git stash pop"

  # Soft abort: cancel in-progress merge/rebase/cherry-pick/am WITHOUT 'git clean -fd',
  # so any untracked working-tree files that did not make it into the stash are preserved.
  _log_step "Aborting any in-progress merge/rebase/cherry-pick/am (working tree preserved)..."
  command rm -rf .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2> /dev/null
  git merge --abort 2> /dev/null
  git rebase --abort 2> /dev/null
  git cherry-pick --abort 2> /dev/null
  git am --abort 2> /dev/null

  _log_step "Fetching latest from origin..."
  git clean-and-fetch

  _log_step "Resolving default branch..."
  local default_branch
  default_branch=$(_get_default_branch) || return 1
  echo "  -> default branch: $default_branch"

  local current_branch
  current_branch=$(git branch --show-current)
  echo "  -> current branch: $current_branch"

  # Back up current branch to a temp branch
  local temp_branch="temp/$(command date +%Y%m%d-%H%M%S)"
  _log_step "Backing up current branch to temp branch: $temp_branch ..."
  git checkout -b "$temp_branch" > /dev/null 2>&1

  _log_step "Deleting local '$default_branch' (will be re-fetched from origin)..."
  git del "$default_branch" > /dev/null 2>&1

  _log_step "Checking out '$default_branch'..."
  git checkout "$default_branch" > /dev/null 2>&1

  _log_step "Rebasing '$default_branch' onto 'origin/$default_branch'..."
  git rebase "origin/$default_branch" > /dev/null 2>&1

  _log_step "Cleaning up temp backup branch: $temp_branch ..."
  git del "$temp_branch" > /dev/null 2>&1

  _log_step "Deleting stale local branches whose upstream is gone (squash-merged PRs)..."
  git clean-stale-branches

  _log_step "Pruning stale worktree references..."
  git worktree prune

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
# ---- Search Functions ----
################################################################################
if type -P rg &> /dev/null; then
  alias gr="rg -in"      # recursive, case-insensitive, line numbers (rg is recursive by default)
  alias gre="rg -inw -F" # gr + fixed string, whole word match
else
  alias gr="grep --color -rin"    # recursive, case-insensitive, line numbers
  alias gre="grep --color -rinFw" # gr + fixed string, whole word match
fi

# search content in files: uses rg if available, git grep in git repos, falls back to grep
# flags: -F fixed string, -w whole word, -i case-insensitive, -n line numbers
function search() {
  if type -P rg &> /dev/null; then
    rg -Fwin "$@" # ripgrep: fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  elif git rev-parse --is-inside-work-tree &> /dev/null; then
    git grep -Fwin "$@" # fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  else
    grep --color -rFwin "$@" . # recursive, fixed string, whole word, case-insensitive, line numbers
  fi
}

################################################################################
# ---- Rainbow / Visual ----
################################################################################
rainbow_block="##########"
rainbow_colors=(91 93 92 96 94 95)

function rainbow_print() {
  local colors
  if [[ -n "$1" && "$1" =~ ^[0-9[:space:]]+$ ]]; then
    colors=($1)
    shift
  else
    colors=("${rainbow_colors[@]}")
  fi

  local input="${1:-$(command cat -)}"
  local color_count=${#colors[@]}

  for ((i = 0; i < ${#input}; i++)); do
    local color_idx=$((i % color_count))
    local color=${colors[$color_idx]}
    printf "\e[%sm%s\e[0m" "$color" "${input:$i:1}"
  done
  echo
}

# br [count] [no-clear] [reverse]
function br() {
  local repeat_count=${1:-5}
  local clear_flag=${2:-"clear"}
  local reverse_flag=${3:-"normal"}

  [[ "$clear_flag" != "no-clear" ]] && printf "\033[H\033[2J"

  local colors=("${rainbow_colors[@]}")

  if [[ "$reverse_flag" == "reverse" ]]; then
    local reversed=()
    for ((i = ${#colors[@]} - 1; i >= 0; i--)); do
      reversed+=("${colors[i]}")
    done
    colors=("${reversed[@]}")
  fi

  local line=""
  for ((i = 0; i < repeat_count; i++)); do
    line+="$rainbow_block"
  done

  echo "$line" | rainbow_print "${colors[*]}"
}

# spinner &; SPIN_PID=$!; sleep 3; kill $SPIN_PID
function spinner() {
  local chars="/-\|"
  local colors=(91 93 92 96 94 95)
  local c_idx=0

  tput civis
  trap "tput cnorm; exit" SIGINT

  while true; do
    for ((i = 0; i < ${#chars}; i++)); do
      local color="${colors[$c_idx]}"
      echo -ne $'\e[1;'"${color}m${chars:$i:1}"$'\e[m'"\r"
      sleep 0.1
      c_idx=$(((c_idx + 1) % ${#colors[@]}))
    done
  done
}

################################################################################
# ---- Chmod ----
################################################################################
function chmod() {
  if [ $# -eq 0 ]; then
    echo "
      chmod cheat sheet:
        chmod +x file        # add execute for everyone
        chmod u+x file       # add execute for owner
        chmod g+w file       # add write for group
        chmod o-r file       # remove read for others
        chmod u+rwx file     # owner: read + write + execute
        chmod go-wx file     # group & others: remove write + execute
        chmod a+r file       # all: add read
        chmod u+x,g+r,o-w file

        Who:   u (user/owner), g (group), o (others), a (all)
        What:  + (add), - (remove), = (set exactly / replaces)
        Perms: r (read), w (write), x (execute)
    "
  else
    command chmod "$@"
  fi
}

################################################################################
# ---- Date / Time ----
################################################################################
# Returns HH:MM:SS AM/PM with colored AM/PM indicator for PS1
function get_time() {
  local tz=${1:-""}
  local time_str ampm

  if [ "$tz" = "UTC" ]; then
    time_str=$(command date -u +'%I:%M:%S')
    ampm=$(command date -u +'%p')
  elif [ -n "$tz" ]; then
    time_str=$(TZ="$tz" command date +'%I:%M:%S')
    ampm=$(TZ="$tz" command date +'%p')
  else
    time_str=$(command date +'%I:%M:%S')
    ampm=$(command date +'%p')
  fi

  if [ "$ampm" = "AM" ]; then
    printf '%s\001\e[1;97m\002%s\001\e[m\002' "$time_str" "$ampm"
  else
    printf '%s\001\e[0;90m\002%s\001\e[m\002' "$time_str" "$ampm"
  fi
}

# no args: show UTC, PST, LOCAL; with args: passthrough to date
function date() {
  if [ $# -eq 0 ]; then
    echo $'\e[1;31m>> UTC\e[m'
    command date -u +'%a, %b %d, %Y  %r'

    echo $'\e[1;96m>> PST (California)\e[m'
    TZ="America/Los_Angeles" command date +'%a, %b %d, %Y  %r'

    echo $'\e[1;92m>> LOCAL\e[m'
    command date +'%a, %b %d, %Y  %r'
  else
    command date "$@"
  fi
}

################################################################################
# ---- Telemetry ----
################################################################################
# universal
export DO_NOT_TRACK="1" # universal opt-out respected by many CLI tools (consoledonottrack.com)
# anthropic - claude code
export DISABLE_TELEMETRY="1"                        # opt out of Claude Code telemetry
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1" # disable Claude Code non-essential traffic (telemetry, autoupdater, error reporting)
# aws
export SAM_CLI_TELEMETRY="0" # opt out of AWS SAM CLI telemetry
# google - angular
export ANGULAR_CLI_ANALYTICS="false" # opt out of Angular CLI analytics
# hashicorp
export CHECKPOINT_DISABLE="1" # opt out of HashiCorp telemetry (Terraform, Vagrant, etc.)
# microsoft - azure
export FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT="1" # opt out of Azure CLI telemetry
# microsoft - dotnet
export DOTNET_CLI_TELEMETRY_OPTOUT="1" # opt out of .NET CLI telemetry
# vercel
export NEXT_TELEMETRY_DISABLED="1"  # opt out of Next.js telemetry
export TURBO_TELEMETRY_DISABLED="1" # opt out of Turborepo telemetry
# web frameworks
export ASTRO_TELEMETRY_DISABLED="1"  # opt out of Astro telemetry
export GATSBY_TELEMETRY_DISABLED="1" # opt out of Gatsby telemetry
export NUXT_TELEMETRY_DISABLED="1"   # opt out of Nuxt telemetry

################################################################################
# ---- Environment ----
################################################################################
# anthropic - claude code
export CLAUDE_CODE_DISABLE_TERMINAL_TITLE="1" # prevent Claude Code from overwriting the terminal tab title
# astral - uv
export UV_VENV_CLEAR="1" # skip "replace existing venv?" prompt in uv venv
# github - electron
export ELECTRON_ENABLE_LOGGING="0" # suppress Electron's internal console spam for slight perf gain
# terminal
export TERM="xterm-256color" # enable 256-color support in terminal emulators
export COLORTERM="truecolor" # advertise 24-bit RGB color support to CLI apps

################################################################################
# ---- Prompt Helpers ----
################################################################################
# shows branch name, remote (if not origin), and ahead/behind counts
# cached: refreshes on branch change, after max_age seconds, or max_calls calls
# invalidated automatically by git() wrapper on state-changing commands
_git_branch_cache=""
_git_branch_last=""
_git_branch_count=0
_git_branch_time=0
_git_branch_max_age=1200 # 20 minutes
_git_branch_max_calls=30
function _invalidate_git_cache() {
  _git_branch_cache=""
  _git_branch_last=""
}
function _parse_git_branch_fetch() {
  local branch ahead behind remote remote_name info=""
  branch=$(git symbolic-ref --short HEAD 2> /dev/null) || return
  remote=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2> /dev/null)
  if [ -n "$remote" ]; then
    remote_name="${remote%%/*}"
    [ "$remote_name" != "origin" ] && info+=" ${remote_name}/"
    ahead=$(git rev-list --count @{u}..HEAD 2> /dev/null)
    behind=$(git rev-list --count HEAD..@{u} 2> /dev/null)
    [ "$ahead" -gt 0 ] 2> /dev/null && info+=" +${ahead}"
    [ "$behind" -gt 0 ] 2> /dev/null && info+=" -${behind}"
  fi
  echo "[${branch}${info}]"
}
function parse_git_branch() {
  type -P git &> /dev/null || return
  local branch now
  branch=$(git symbolic-ref --short HEAD 2> /dev/null) || {
    _git_branch_cache=""
    _git_branch_last=""
    return
  }
  now=$(command date +%s)
  _git_branch_count=$((_git_branch_count + 1))
  # refresh on branch change, time expiry, or call count
  if [ "$branch" != "$_git_branch_last" ] || [ -z "$_git_branch_cache" ] || [ $((now - _git_branch_time)) -ge $_git_branch_max_age ] || [ $_git_branch_count -ge $_git_branch_max_calls ]; then
    _git_branch_cache=$(_parse_git_branch_fetch)
    _git_branch_last="$branch"
    _git_branch_time=$now
    _git_branch_count=0
  fi
  echo "$_git_branch_cache"
}

# shows local IP addresses (cached, refreshes after max_age seconds or max_calls calls)
_ifconfig2_cache=""
_ifconfig2_count=0
_ifconfig2_time=0
_ifconfig2_max_age=1800 # 30 minutes
_ifconfig2_max_calls=60
function _ifconfig2_fetch() {
  hostname -I 2> /dev/null | tr ' ' '\n' | grep '\.' | grep -v '^127\.' | sort -u | paste -sd',' - \
    || command ifconfig 2> /dev/null | grep 'inet ' | awk '{print $2}' | grep -v '^127\.' | sort -u | paste -sd',' -
}
# running ifconfig manually invalidates the IP cache and shows full output
function ifconfig() {
  _ifconfig2_cache=""
  command ifconfig "$@"
}
function ifconfig2() {
  local now=$(command date +%s)
  _ifconfig2_count=$((_ifconfig2_count + 1))
  if [ -z "$_ifconfig2_cache" ] || [ $((now - _ifconfig2_time)) -ge $_ifconfig2_max_age ] || [ $_ifconfig2_count -ge $_ifconfig2_max_calls ]; then
    _ifconfig2_cache=$(_ifconfig2_fetch)
    _ifconfig2_time=$now
    _ifconfig2_count=0
  fi
  echo "$_ifconfig2_cache"
}

# truncates deep paths, keeping last 3 parts full
function shorter_pwd_path() {
  local trim_count=3
  local current_path="${PWD/#$HOME/\~}"
  IFS='/' read -r -a splits <<< "$current_path"
  result=""

  for idx in "${!splits[@]}"; do
    if [ $idx -lt $((${#splits[@]} - $trim_count)) ]; then
      result+="${splits[$idx]:0:1}/"
    else
      result+="${splits[$idx]}/"
    fi
  done

  echo "${result%/}"
}

################################################################################
# ---- Prompt ----
################################################################################
# 08:32:43PM U=04:32:43AM syle @ Sy-Omen45L 10.255.255.254,172.28.2.202
# ~/git/bashrc [master]
# >>>
export PS1="\[\e[2 q\]\[\e[1;92m\]\$(get_time) \
\[\e[1;93m\]U=\$(get_time \"UTC\") \
\[\e[1;94m\]\u\[\e[m\] @ \
\[\e[1;95m\]\h \
\[\e[1;93m\]\$(ifconfig2)\[\e[m\]\n\
\[\e[1;31m\]\$(shorter_pwd_path)\[\e[m\] \
\[\e[1;36m\]\$(parse_git_branch)\[\e[m\]\n\
>>> "

################################################################################
# ---- Aliases: Docker ----
################################################################################
alias d='docker'
alias drun='docker run'
alias dexec='dexec_bash'
alias apt='sudo apt-get'

################################################################################
# ---- Docker ----
################################################################################
function dexec_bash() {
  echo "docker exec -it $@ /bin/bash"
  docker exec -it $@ /bin/bash
}

################################################################################
# ---- Open (cross-platform) ----
################################################################################
function open() {
  # Single optional arg — defaults to "." (current directory). Always prints the
  # action summary so users see exactly what's being opened and where.
  local target="${1:-.}"
  print_action_summary "$target" open

  if ((is_os_mac)); then
    command open "$target"
  elif type -P explorer.exe &> /dev/null; then
    explorer.exe "$target"
  elif type -P dolphin &> /dev/null; then
    dolphin "$target" 1>&- 2>&- &
  elif type -P thunar &> /dev/null; then
    thunar "$target" 1>&- 2>&- &
  elif type -P xdg-open &> /dev/null; then
    xdg-open "$target" 1>&- 2>&- &
  else
    echo "No file manager found"
  fi

  # When the target is a folder, the OS file manager is the predictable receiver
  # (Finder on mac, Explorer on Windows/WSL). Bring it to the foreground and tile
  # via the same dispatcher run_editor / run_browser use. For files we skip —
  # the default-app handler is unknown (could be Preview, Sublime, anything).
  #
  # TODO: extend to native Linux file managers (Dolphin / Thunar / xdg-open).
  # Dispatcher branch is by `type -P` above; mirror that here with the right
  # app_name per tool ("Dolphin", "Thunar"). xdg-open is the tricky one — it
  # routes to whatever the user's default file manager is, so we'd either
  # query xdg-mime or accept the unknown and skip.
  if [ -d "$target" ]; then
    local app_name=""
    if ((is_os_mac)); then
      app_name="Finder"
    elif ((is_os_wsl)); then
      app_name="Windows Explorer"
    fi
    if [[ -n "$app_name" ]]; then
      (maximize_and_focus_window "$app_name" > /dev/null 2>&1 &)
    fi
  fi
}

################################################################################
# ---- Maximize & Focus Window (cross-platform dispatcher) ----
#
# Brings a GUI app's window to the foreground and maximizes its main window.
# Used by run_editor and run_browser after launching the app in the background.
#
# Platform detection order:
#   1. macOS              — JXA + osascript (maximize to visible frame of the
#                           display under the mouse, tile extras in a grid)
#   2. WSL (Windows host) — powershell.exe + user32 P/Invoke (matches window by
#                           MainWindowTitle, ShowWindow(SW_MAXIMIZE), SetForegroundWindow)
#   3. Wayland            — try sway first (swaymsg), then XWayland via wmctrl;
#                           noop on KDE/GNOME where no portable CLI exists
#   4. X11                — wmctrl (preferred), fallback xdotool
#
# All branches silently noop if the required tool is missing. Callers do not
# need to guard with `((is_os_*))`.
################################################################################
function maximize_and_focus_window() {
  local app_name="$1"
  # Optional 2nd arg: macOS System Events process name. Defaults to app_name.
  # Pass explicitly when bundle display name != executable name (e.g. VS Code:
  # bundle "Visual Studio Code" / process "Code").
  local process_name="${2:-$app_name}"
  [[ -z "$app_name" ]] && return 0

  if ((is_os_mac)); then
    _mac_activate_and_tile "$app_name" "$process_name" 2> /dev/null
  elif ((is_os_wsl)); then
    _wsl_activate_and_maximize "$app_name" 2> /dev/null
  elif [[ -n "$WAYLAND_DISPLAY" ]]; then
    _wayland_activate_and_maximize "$app_name" 2> /dev/null
  elif [[ -n "$DISPLAY" ]]; then
    _x11_activate_and_maximize "$app_name" 2> /dev/null
  fi
  # Best-effort: never signal failure to the caller. An app that is not running,
  # does not expose window-1, or a missing wmctrl/powershell.exe should not trip
  # `set -e` or leave a non-zero $? in the user's shell.
  return 0
}

# X11 implementation: prefer wmctrl, fall back to xdotool. Both match by window
# title substring. Silent noop if neither tool is installed.
function _x11_activate_and_maximize() {
  local app_name="$1"
  if type -P wmctrl &> /dev/null; then
    wmctrl -a "$app_name" 2> /dev/null || return 0
    wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2> /dev/null
  elif type -P xdotool &> /dev/null; then
    local wid
    wid=$(xdotool search --name "$app_name" 2> /dev/null | head -1)
    [[ -z "$wid" ]] && return 0
    xdotool windowactivate "$wid" 2> /dev/null
    xdotool key --window "$wid" super+Up 2> /dev/null
  fi
}

# Wayland implementation: no universal window-control protocol. Best effort:
# - sway             — swaymsg focus + fullscreen
# - XWayland apps    — wmctrl still works for X11 apps in Wayland sessions
# - KDE/GNOME native — noop (requires shell extensions / DBus plumbing per-app)
function _wayland_activate_and_maximize() {
  local app_name="$1"
  if type -P swaymsg &> /dev/null; then
    swaymsg "[title=\"$app_name\"] focus" 2> /dev/null
    swaymsg "[title=\"$app_name\"] fullscreen enable" 2> /dev/null
  elif type -P wmctrl &> /dev/null; then
    wmctrl -a "$app_name" 2> /dev/null || return 0
    wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2> /dev/null
  fi
}

# WSL implementation: drive the Windows side via powershell.exe. Matches a
# window by MainWindowTitle substring, then calls user32!ShowWindow(SW_MAXIMIZE)
# + SetForegroundWindow via a tiny P/Invoke type. Silent noop if powershell.exe
# is missing or no matching window is found.
function _wsl_activate_and_maximize() {
  local app_name="$1"
  type -P powershell.exe &> /dev/null || return 0
  powershell.exe -NoProfile -Command "
    Add-Type -Name Win32 -Namespace BashrcWin -MemberDefinition '
      [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    ' 2>\$null;
    Get-Process | Where-Object { \$_.MainWindowTitle -like '*$app_name*' } | ForEach-Object {
      [BashrcWin.Win32]::ShowWindow(\$_.MainWindowHandle, 3) | Out-Null;
      [BashrcWin.Win32]::SetForegroundWindow(\$_.MainWindowHandle) | Out-Null;
    }
  " 2> /dev/null
}

# macOS implementation: resolve the visible frame of the display under the mouse
# cursor, set window 1 of $app_name to that rect, and tile extra windows in a
# 300x200 grid from the top-left so they are easy to reach.
function _mac_activate_and_tile() {
  local app_name="$1"
  # System Events uses the *process* (executable) name, not the bundle display
  # name. Fall back to app_name when the caller does not provide one. e.g. VS
  # Code: bundle "Visual Studio Code" / process "Code".
  local process_name="${2:-$app_name}"
  [[ -z "$app_name" ]] && return 0

  # Resolve visible frame (AppleScript coords: top-left origin) of the display containing the mouse cursor
  local _disp _mx _my _mw _mh
  _disp=$(
    osascript -l JavaScript << 'JXA' 2> /dev/null
ObjC.import('AppKit');
const m = $.NSEvent.mouseLocation;
const ss = $.NSScreen.screens;
let t = ss.objectAtIndex(0);
for (let i = 0; i < ss.count; i++) {
  const s = ss.objectAtIndex(i), f = s.frame;
  if (m.x >= f.origin.x && m.x < f.origin.x + f.size.width &&
      m.y >= f.origin.y && m.y < f.origin.y + f.size.height) {
    t = s;
    break;
  }
}
const vf = t.visibleFrame;
const ph = ss.objectAtIndex(0).frame.size.height;
[Math.round(vf.origin.x), Math.round(ph - (vf.origin.y + vf.size.height)), Math.round(vf.size.width), Math.round(vf.size.height)].join(' ');
JXA
  )
  read -r _mx _my _mw _mh <<< "$_disp"
  # Fallback to primary desktop bounds if JXA failed
  if [[ -z "$_mw" || -z "$_mh" ]]; then
    _mx=0
    _my=0
    read -r _mw _mh <<< "$(osascript -e 'tell application "Finder" to set {_, _, sw, sh} to bounds of window of desktop' -e 'return (sw as string) & " " & (sh as string)' 2> /dev/null)"
  fi
  # `activate` is non-blocking — Electron apps (VS Code) take a beat to spawn their
  # first window, so we poll up to ~10s for window 1 of the process to exist before
  # tiling. Without this, a cold `code .` no-ops because window 1 does not exist yet.
  osascript << APPLESCRIPT 2> /dev/null
tell application "$app_name" to activate
tell application "System Events"
  set deadline to (current date) + 10
  repeat while (current date) < deadline
    if exists process "$process_name" then
      tell process "$process_name"
        if (count of windows) > 0 then exit repeat
      end tell
    end if
    delay 0.2
  end repeat
end tell
tell application "System Events" to tell process "$process_name"
  if (count of windows) is 0 then return
  set position of window 1 to {$_mx, $_my}
  set size of window 1 to {$_mw, $_mh}
  set windowCount to count of windows
  if windowCount > 1 then
    set tileW to 300
    set tileH to 200
    set tileCols to $_mw div tileW
    repeat with i from 2 to windowCount
      set tileCol to ((i - 2) mod tileCols)
      set tileRow to ((i - 2) div tileCols)
      set position of window i to {$_mx + (tileCol * tileW), $_my + (tileRow * tileH)}
      set size of window i to {tileW, tileH}
    end repeat
  end if
end tell
APPLESCRIPT
}

################################################################################
# ---- Unwrap (paragraph-block line-rejoin) ----
# Rejoins terminal-wrapped paragraphs from stdin so copy/paste preserves
# logical lines instead of the visual wrap. Cross-platform — Claude Code,
# `less`, `man`, etc. all emit hard `\n`s at the terminal width on every OS,
# so this lives at the top level (not gated by is_os_*).
#
# Detection is shape-based: text is split into blocks separated by blank
# lines. A block is treated as "wrapped" only when ALL of these hold:
#   - all lines except the last are within HEAD_TOLERANCE chars of each other
#     (terminal wrap is uniform-width by definition)
#   - the widest "head" line is at least MIN_HEAD_WIDTH (filters short bullet
#     lists and labels — wrapped prose is always near terminal width)
#   - the last line is at least LAST_GAP chars shorter than the head
#     (wrapped paragraphs always end with a partial line)
# Everything else is preserved as-is — so unevenly-shaped lists, code,
# tables, ASCII art, and short paragraphs all keep their original line
# breaks. ``` fenced blocks are always preserved verbatim.
#
# Falls back to passthrough (`cat`) when node is unavailable, so callers
# (notably `copy()`) keep working on minimal systems.
################################################################################
function unwrap() {
  if is_help_arg "${1:-}"; then
    echo "
      unwrap: rejoin terminal-wrapped paragraphs from stdin
        echo \$'foo\\nbar' | unwrap     rejoin a single paragraph
        pbpaste | unwrap | pbcopy      fix the clipboard in place
        u                              short alias for unwrap
      Joins only when a block looks uniformly wrapped; preserves everything else.
    "
    return 0
  fi
  if ! type -P node &> /dev/null; then
    command cat
    return 0
  fi
  node -e "$(
    command cat << 'JS_EOF'
const text = require('fs').readFileSync(0, 'utf8');
const FENCE = '\x60\x60\x60';
const HEAD_TOLERANCE = 5;   // head-line widths must agree within this many chars
const MIN_HEAD_WIDTH = 50;  // ignore short blocks (bullet lists, labels)
const LAST_GAP = 10;        // last line must be this much shorter than the head

const lines = text.split('\n');
const out = [];
let block = [];
let inFence = false;

const flushBlock = () => {
  if (block.length === 0) return;
  if (block.length < 2) { out.push(block[0]); block = []; return; }
  const lens = block.map((l) => l.length);
  const headLens = lens.slice(0, -1);
  const lastLen = lens[lens.length - 1];
  const headMax = Math.max.apply(null, headLens);
  const headMin = Math.min.apply(null, headLens);
  const isWrapped =
    headMax - headMin <= HEAD_TOLERANCE &&
    headMax >= MIN_HEAD_WIDTH &&
    headMax - lastLen >= LAST_GAP;
  if (isWrapped) {
    out.push(block.map((l) => l.trim()).join(' '));
  } else {
    for (const l of block) out.push(l);
  }
  block = [];
};

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.slice(0, 3) === FENCE) {
    flushBlock();
    out.push(line);
    inFence = !inFence;
    continue;
  }
  if (inFence) { out.push(line); continue; }
  if (trimmed === '') { flushBlock(); out.push(''); continue; }
  block.push(line);
}
flushBlock();
let result = out.join('\n');
if (text.endsWith('\n') && !result.endsWith('\n')) result += '\n';
process.stdout.write(result);
JS_EOF
  )"
}
alias u=unwrap

################################################################################
# ---- Clipboard (copy / paste) ----
# universal clipboard with graceful fallbacks:
#   mac: native pbcopy/pbpaste
#   wsl: clip.exe / powershell.exe Get-Clipboard
#   wayland: wl-copy / wl-paste
#   x11: xclip -selection clipboard
#   fallback: folder-only (no native clipboard)
# all copies are saved to ~/.bash_syle_copies/ (last 10 entries)
# input is piped through unwrap() first so the clipboard never holds
# terminal-wrapped paragraphs.
################################################################################
_CLIPBOARD_DIR=~/.bash_syle_copies
_CLIPBOARD_MAX=10
mkdir -p "$_CLIPBOARD_DIR"

if ((is_os_mac)); then
  _COPY_CMD="pbcopy"
  _PASTE_CMD="pbpaste"
elif ((is_os_wsl)) && type -P clip.exe &> /dev/null && type -P powershell.exe &> /dev/null; then
  _COPY_CMD="clip.exe"
  _PASTE_CMD="powershell.exe -NoProfile -Command Get-Clipboard | sed 's/\r$//'"
elif [ -n "$WAYLAND_DISPLAY" ] && type -P wl-copy &> /dev/null && type -P wl-paste &> /dev/null; then
  _COPY_CMD="wl-copy"
  _PASTE_CMD="wl-paste"
elif [ -n "$DISPLAY" ] && type -P xclip &> /dev/null; then
  _COPY_CMD="xclip -selection clipboard"
  _PASTE_CMD="xclip -selection clipboard -o"
else
  _COPY_CMD=""
  _PASTE_CMD=""
fi

# save stdin to clipboard history folder + native clipboard (if available)
# prunes entries beyond _CLIPBOARD_MAX
function _clipboard_save() {
  local clip_file="$_CLIPBOARD_DIR/$(date +%Y-%m-%d_%H-%M-%S)"
  [ -f "$clip_file" ] && clip_file="${clip_file}_${RANDOM}"
  # unwrap rejoins terminal-wrapped paragraphs before anything reaches the
  # OS clipboard or the history file — the user's intent is to copy logical
  # lines, not the visual wrap that happened to fit the terminal width.
  if [ -n "$_COPY_CMD" ]; then
    unwrap | tee "$clip_file" | eval "$_COPY_CMD"
  else
    unwrap > "$clip_file"
  fi
  ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | tail -n +$((_CLIPBOARD_MAX + 1)) | while read -r f; do
    rm -f "$_CLIPBOARD_DIR/$f"
  done
}

# copy: stdin or files/strings into clipboard + history
function copy() {
  if [ $# -eq 0 ]; then
    # No args + stdin is a TTY (no pipe) → rewrap the existing clipboard in
    # place. `paste` is raw by default, so we pass --unwrap explicitly to pull
    # the clipboard through the unwrap filter, then pipe to copy which writes
    # it back. The recursive `copy` call hits the pipe branch (stdin not a
    # TTY) and bottoms out at _clipboard_save — no infinite loop.
    if [ -t 0 ]; then
      paste --unwrap | copy
    else
      _clipboard_save
    fi
  elif is_help_arg "$1"; then
    echo "
      copy: stdin or files/strings into clipboard + history
        copy                   rewrap the existing clipboard in place (no pipe, no args)
        echo foo | copy        pipe stdin into clipboard
        copy file.txt          copy file contents into clipboard
        copy a.txt b.txt       copy multiple files (concatenated) into clipboard
        copy \"hello world\"     copy a string into clipboard
        copy help              show this help
    "
  else
    for arg in "$@"; do
      if [ -f "$arg" ]; then
        command cat "$arg"
      else
        echo "$arg"
      fi
    done | _clipboard_save
  fi
}

# paste: print clipboard, recall from history, or forward to real paste(1)
# Default is RAW — clipboard contents are returned verbatim. Pass --unwrap
# (or pipe through `unwrap` manually) to rejoin terminal-wrapped paragraphs.
function paste() {
  if [ $# -eq 0 ]; then
    if [ -n "$_PASTE_CMD" ]; then
      eval "$_PASTE_CMD"
    else
      local latest
      latest=$(ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -1)
      [ -n "$latest" ] && command cat "$_CLIPBOARD_DIR/$latest"
    fi
  elif [ "$1" = "--unwrap" ]; then
    paste | unwrap
  elif is_help_arg "$1"; then
    echo "
      paste: print clipboard, recall from history, or forward to paste(1)
        paste                  print clipboard contents (raw) to stdout
        paste --unwrap         print clipboard rejoined via unwrap
        paste list             show clipboard history entries
        paste <entry>          recall a specific entry from history (raw)
        paste help             show this help
        paste file1 file2      forward to /usr/bin/paste (merge lines)
    "
  elif [ "$1" = "list" ]; then
    ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -n "$_CLIPBOARD_MAX"
  elif [ -f "$_CLIPBOARD_DIR/$1" ]; then
    command cat "$_CLIPBOARD_DIR/$1"
  else
    command paste "$@"
  fi
}

################################################################################
# ---- TLDR (shell function aware) ----
# wraps tldr to show inline --help for shell functions before falling back to real tldr
################################################################################
function tldr() {
  # type -t returns the type as a single word (function, alias, builtin, file)
  # we use -t here (not -P) because we need to distinguish functions from binaries
  if [ "$(type -t "$1" 2> /dev/null)" = "function" ]; then
    "$1" --help
  else
    command tldr "$@"
  fi
}

################################################################################
# ---- Network Utilities ----
################################################################################
# _expand_port_args: expand a list of port args (single ports and ranges) into individual ports
function _expand_port_args() {
  local arg
  for arg in "$@"; do
    if [[ "$arg" =~ ^([0-9]+)-([0-9]+)$ ]]; then
      local start="${BASH_REMATCH[1]}"
      local end="${BASH_REMATCH[2]}"
      if [ "$start" -gt "$end" ]; then
        echo ">> Invalid range: $arg (start > end)" >&2
        return 1
      fi
      seq "$start" "$end"
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
      echo "$arg"
    else
      echo ">> Invalid port: $arg (must be a number or range like 3000-4000)" >&2
      return 1
    fi
  done
}

# list_ports: list processes listening on the given ports
function list_ports() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "list_ports: list processes listening on the given TCP ports
  Usage: list_ports <port|range> [port|range ...]
  Examples:
    list_ports 3000
    list_ports 3000 3001 4000
    list_ports 3000-3010
    list_ports 80 3000-3005 8080"
    return 0
  fi

  local ports
  ports="$(_expand_port_args "$@")" || return 1

  local port found=0
  while IFS= read -r port; do
    if lsof -i tcp:"$port" -sTCP:LISTEN &> /dev/null; then
      echo "Port $port is in use:"
      lsof -i tcp:"$port" -sTCP:LISTEN
      echo ""
      found=1
    fi
  done <<< "$ports"

  if ! ((found)); then
    echo ">> No processes found on the given ports."
  fi
}

# kill_port: kill the process listening on a single port
function kill_port() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "kill_port: kill the process listening on a single TCP port
  Usage: kill_port <port>"
    return 0
  fi

  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2> /dev/null)"
  if [ -z "$pids" ]; then
    echo "  > Kill > Port $port > Skipped (nothing running on port)"
    return 0
  fi
  if echo "$pids" | xargs kill -9 2> /dev/null; then
    echo "  > Kill > Port $port > Success"
  else
    if [ "$port" -lt 1024 ]; then
      echo "  > Kill > Port $port > Error (privileged port, sudo may be required)"
    else
      echo "  > Kill > Port $port > Error (failed to kill process)"
    fi
    return 1
  fi
}

# kill_ports: kill processes listening on the given TCP ports
function kill_ports() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "kill_ports: kill processes listening on the given TCP ports
  Usage: kill_ports <port|range> [port|range ...]
  Examples:
    kill_ports 3000
    kill_ports 3000 3001 4000
    kill_ports 3000-4000
    kill_ports 80 3000-3005 8080"
    return 0
  fi

  local ports
  ports="$(_expand_port_args "$@")" || return 1

  local port needs_sudo=0 port_list=""
  while IFS= read -r port; do
    local status="free"
    if lsof -i tcp:"$port" -sTCP:LISTEN &> /dev/null; then
      status="in use"
    fi
    if [ "$port" -lt 1024 ]; then
      port_list="${port_list}  port $port ($status) [requires sudo]\n"
      needs_sudo=1
    else
      port_list="${port_list}  port $port ($status)\n"
    fi
  done <<< "$ports"

  echo "The following ports will be targeted:"
  echo -e "$port_list"

  if ((needs_sudo)); then
    echo ">> Warning: some ports are below 1024 and may require admin/sudo to kill."
    echo ""
  fi

  if ! prompt_yes_no "Proceed with killing processes on these ports?"; then
    echo ">> Aborted."
    return 1
  fi

  echo ""
  while IFS= read -r port; do
    kill_port "$port"
  done <<< "$ports"
}

# portcheck: check if a TCP port is in use
function portcheck() {
  local port="$1"
  if [ -z "$port" ] || is_help_arg "$1"; then
    echo "portcheck: check if a TCP port is in use
  Usage: portcheck <port>"
    return 1
  fi
  if lsof -i tcp:"$port" -sTCP:LISTEN &> /dev/null; then
    echo "Port $port is in use:"
    lsof -i tcp:"$port" -sTCP:LISTEN
  else
    echo "Port $port is free"
  fi
}

# tunnel: expose a local server via Cloudflare Tunnel (cloudflared)
if type -P cloudflared &> /dev/null; then
  function tunnel() {
    if [ $# -eq 0 ] || is_help_arg "$1"; then
      echo "
        tunnel: expose a local server via Cloudflare Tunnel
          Usage: tunnel [port|url]
          tunnel 3000              → tunnel http://localhost:3000
          tunnel 8080              → tunnel http://localhost:8080
          tunnel http://localhost   → tunnel http://localhost (port 80)
      "
      return 0
    fi
    local target="$1"
    case "$target" in
    http://* | https://*) ;;
    *) target="http://localhost:$target" ;;
    esac
    echo ">> Tunneling $target via cloudflared"
    command cloudflared tunnel --url "$target"
  }
fi

################################################################################
# ---- Retry ----
################################################################################
function retry() {
  local count="$1"
  shift

  if [ -z "$count" ] || [ -z "$1" ] || is_help_arg "$count"; then
    echo "
      retry: retry a command up to N times
        Usage: retry <count> <command...>
    "
    return 1
  fi

  local attempt=1
  while [ "$attempt" -le "$count" ]; do
    echo ">> Attempt $attempt/$count: $*"
    if "$@"; then
      return 0
    fi
    attempt=$((attempt + 1))
    [ "$attempt" -le "$count" ] && sleep "$attempt"
  done

  echo ">> Failed after $count attempts: $*"
  return 1
}

################################################################################
# ---- Benchmark ----
################################################################################
function benchmark() {
  if [ -z "$1" ] || is_help_arg "$1"; then
    echo "
      benchmark: measure how long a command takes
        Usage: benchmark <command...>
    "
    return 1
  fi

  local start_time end_time elapsed
  start_time=$(date +%s%N 2> /dev/null || date +%s)
  "$@"
  local exit_code=$?
  end_time=$(date +%s%N 2> /dev/null || date +%s)

  if [ ${#start_time} -gt 10 ]; then
    # nanosecond precision available
    elapsed=$(((end_time - start_time) / 1000000))
    echo ">> Completed in ${elapsed}ms (exit $exit_code)"
  else
    # seconds only (macOS date without coreutils)
    elapsed=$((end_time - start_time))
    echo ">> Completed in ${elapsed}s (exit $exit_code)"
  fi
  return $exit_code
}

################################################################################
# ---- Shared Network Folder ----
# Common base for features that use the shared network volume (dropbox, patches,
# notes, screenshots). Callers append their own subpath.
################################################################################
# shared helper to find the network share root (WSL /mnt/z or macOS /Volumes)
function _shared_folder() {
  local candidates=(
    "/mnt/z"
    "/Volumes/192.168.1.1"
  )
  find_path "${candidates[@]}" --folder
}

# shared helper to find the dropbox folder (used by patch and note functions)
function _dropbox_folder() {
  local shared_folder
  shared_folder=$(_shared_folder) || return 1
  local dropbox="${shared_folder}/dropbox"
  [ -d "$dropbox" ] && echo "$dropbox" || return 1
}

# dropbox: open the dropbox folder
function dropbox() {
  if is_help_arg "${1:-}"; then
    echo "dropbox: open the dropbox folder
  Usage: dropbox"
    return 0
  fi

  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  open "$dropbox_folder" &> /dev/null || echo "$dropbox_folder"
}

################################################################################
# ---- Git Patch Helpers (Dropbox) ----
# Transfers git patches between machines via a shared Dropbox folder.
# _patch_create_and_upload: exports the last commit as a .patch, renames with
#   a repo-date prefix, and moves it to Dropbox.
# _patch_download_and_apply: finds the most recent .patch in Dropbox, applies
#   it, commits, and archives the file.
################################################################################

# download and apply a patch from the dropbox folder, then archive it
function _patch_download_and_apply() {
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local archive_folder="${dropbox_folder}/archived_patch"

  mkdir -p "$archive_folder"

  # find most recently modified .patch file with content (cross-platform via node)
  local latest_patch
  latest_patch=$(
    _PATCH_ARG="$dropbox_folder" node << '_PATCH_FIND_EOF_'
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
  )

  echo "latest_patch: $latest_patch"

  if [ -z "$latest_patch" ]; then
    echo "No .patch files found in $dropbox_folder"
    return 1
  fi

  # extract decoded commit subject from the patch (handles MIME/RFC-2047 encoded headers)
  local commit_msg
  commit_msg=$(git mailinfo /dev/null /dev/null < "$latest_patch" | command grep "^Subject: " | sed 's/^Subject: //')
  commit_msg="${commit_msg:-applied patch}"

  echo "Applying: $latest_patch"
  echo "Message: $commit_msg"

  if git apply --reject --whitespace=fix "$latest_patch" && git add -A && git commit --allow-empty --no-verify -m "$commit_msg"; then
    git commit --amend --reset-author --no-verify
    mv "$latest_patch" "$archive_folder"
    echo "Successfully applied and archived."
  else
    echo "Error occurred during patching/committing. Patch was NOT moved to archive."
    return 1
  fi
}

# create a patch from the last commit, rename with repo-date prefix, and upload to dropbox
function _patch_create_and_upload() {
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  git patch-get

  # rename with mtime prefix and move to dest (cross-platform via node)
  # uses heredoc (single-quoted delimiter) to avoid bash expanding ! and $ inside the script
  _PATCH_ARG="$dropbox_folder" node << '_PATCH_UPLOAD_EOF_' || return 1
    const fs=require('fs'),path=require('path');
    const dest=process.env._PATCH_ARG,proj=path.basename(process.cwd());
    const patches=fs.readdirSync('.').filter(f=>f.endsWith('.patch')&&fs.statSync(f).isFile());
    if(!patches.length){console.log('No .patch files generated');process.exit(1);}
    for(const f of patches){
      const mtime=fs.statSync(f).mtime;
      const ts=mtime.getFullYear()+'_'+String(mtime.getMonth()+1).padStart(2,'0')+'_'+String(mtime.getDate()).padStart(2,'0')+'_'+String(mtime.getHours()).padStart(2,'0')+'_'+String(mtime.getMinutes()).padStart(2,'0');
      const newName=proj+'-'+ts+'-'+f;
      const target=path.join(dest,newName);try{fs.copyFileSync(f,target);}catch{fs.writeFileSync(target,fs.readFileSync(f));}fs.unlinkSync(f);
      console.log('Moved: '+newName);
    }
_PATCH_UPLOAD_EOF_

  dot_clean "${dropbox_folder}" &> /dev/null &
  open "${dropbox_folder}" &> /dev/null &
  echo "${dropbox_folder}"
}

# copy the last commit's patch to clipboard
function _patch_view_copy() {
  clear
  git patch-view | copy
}

# patch_cleanup: archive loose .patch files, keep only the N newest in archived_patch
function patch_cleanup() {
  if is_help_arg "${1:-}"; then
    echo "patch_cleanup: move loose .patch files into archived_patch and keep only the newest N
  Usage: patch_cleanup [keep=3]
  Examples:
    patch_cleanup       keep 3 newest patches (default)
    patch_cleanup 5     keep 5 newest patches"
    return
  fi

  local keep="${1:-3}"
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local archive_folder="${dropbox_folder}/archived_patch"

  mkdir -p "$archive_folder"

  # move any loose .patch files from dropbox root into the archive folder
  local moved=0
  for f in "$dropbox_folder"/*.patch; do
    [ -f "$f" ] || continue
    mv "$f" "$archive_folder/"
    moved=$((moved + 1))
  done
  echo "Moved $moved .patch file(s) to $archive_folder"

  # sort by modification time (newest first), remove all but the newest N
  local removed=0
  local count=0
  while IFS= read -r f; do
    count=$((count + 1))
    if [ "$count" -gt "$keep" ]; then
      echo "  Removing: $(basename "$f")"
      rm "$f"
      removed=$((removed + 1))
    fi
  done < <(ls -t "$archive_folder"/*.patch 2> /dev/null)

  echo "Kept $keep newest, removed $removed old .patch file(s)"
}

alias patch0='_patch_create_and_upload' # create
alias patch1='_patch_view_copy'
alias patch2='_patch_download_and_apply'
alias patch="patch2"

################################################################################
# ---- Notes (Dropbox) ----
# Opens a shared notes file from the Dropbox notes folder.
# With a truthy arg, creates and opens a timestamped note instead.
################################################################################
# open notes file
function note() {
  if is_help_arg "${1:-}"; then
    echo "
      note: open a shared notes file from Dropbox
        note               open _note.txt
        note 1             create and open a timestamped _note_<timestamp>.txt
        note true|y|yes    same as above
    "
    return 0
  fi

  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local notes_folder="${dropbox_folder}/notes"
  if [ ! -d "$notes_folder" ]; then
    echo "No dropbox notes folder found: $notes_folder"
    return 1
  fi
  local file
  if is_truthy "${1:-}"; then
    file="${notes_folder}/_note_$(command date +%Y-%m-%d-%H-%M).txt"
    touch "$file"
  else
    file="${notes_folder}/_note.txt"
  fi
  subl "$file"
}

################################################################################
# ---- Screenshots (Shared Network Folder) ----
# Backs up local screenshots to the shared network folder, skipping duplicates
# by MD5 hash. Only copies image files (png, jpg, jpeg, gif, bmp, webp, tiff).
################################################################################
# find the local screenshots source folder
function _screenshot_local_folder() {
  local candidates=(
    /mnt/d/Desktop/_screenshots
    "/mnt/c/Users/[Ss][Yy]*/Desktop/_screenshots"
    "/mnt/c/Users/[Ss][Yy]*/Desktop"
    ~/Desktop/_screenshots
    ~/Desktop/
  )
  find_path "${candidates[@]}" --folder
}

# screenshot_backup: copy local screenshots to the shared network folder via cpsync
function screenshot_backup() {
  if is_help_arg "${1:-}"; then
    echo "screenshot_backup: copy local screenshots to the shared network folder
  Uses cpsync to skip unchanged files.
  Usage: screenshot_backup"
    return 0
  fi

  local shared_folder
  shared_folder=$(_shared_folder) || {
    echo "No shared network folder found"
    return 1
  }
  local dest_folder="${shared_folder}/share/_screenshots"
  mkdir -p "$dest_folder"

  local src_folder
  src_folder=$(_screenshot_local_folder) || {
    echo "No local screenshots folder found"
    return 1
  }

  cpsync "$src_folder" "$dest_folder"
}

# screenshot_open_local: open the local screenshots folder
function screenshot_open_local() {
  local src_folder
  src_folder=$(_screenshot_local_folder) || {
    echo "No local screenshots folder found"
    return 1
  }
  open "$src_folder" &> /dev/null || echo "$src_folder"
}

# screenshot_open_shared: open the shared network screenshots folder
function screenshot_open_shared() {
  local shared_folder
  shared_folder=$(_shared_folder) || {
    echo "No shared network folder found"
    return 1
  }
  local dest_folder="${shared_folder}/share/_screenshots"
  if [ -d "$dest_folder" ]; then
    open "$dest_folder" &> /dev/null || echo "$dest_folder"
  else
    echo "No shared screenshots folder found: $dest_folder"
    return 1
  fi
}

alias screenshot_open='screenshot_open_local'

################################################################################
# ---- Sync ----
# Runs common housekeeping tasks: screenshot backup and patch cleanup.
################################################################################
# sync: run backup, screenshot backup, and patch cleanup
function sync() {
  if is_help_arg "${1:-}"; then
    echo "sync: run backup, screenshot backup, and patch cleanup
  Usage: sync"
    return 0
  fi

  local ts
  ts=$(date +%Y_%m_%d_%H_%M)

  local sync_start=$SECONDS
  echo "sync started at $(date)"

  (
    local log="/tmp/log_${ts}_patch_cleanup.txt"
    local start=$SECONDS
    echo "  > patch_cleanup started at $(date)" | tee -a "$log"
    patch_cleanup &> "$log"
    echo "  > patch_cleanup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
  ) &
  (
    local log="/tmp/log_${ts}_screenshot_backup.txt"
    local start=$SECONDS
    echo "  > screenshot_backup started at $(date)" | tee -a "$log"
    screenshot_backup &> "$log"
    echo "  > screenshot_backup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
  ) &
  if type backup &> /dev/null; then
    (
      local log="/tmp/log_${ts}_backup.txt"
      local start=$SECONDS
      echo "  > backup started at $(date)" | tee -a "$log"
      backup &> "$log"
      echo "  > backup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
    ) &
  fi

  wait
  echo "sync done at $(date) ($((SECONDS - sync_start))s). Logs: /tmp/log_${ts}_*.txt"
}

################################################################################
# ---- Bookmarks ----
################################################################################
if type add_bookmark &> /dev/null; then
  add_bookmark fuzzy_edit
  add_bookmark fuzzy_recent_files
  add_bookmark commit_empty_trigger_deploy
fi

################################################################################
# ---- refresh / upgrade ----
################################################################################
# refresh: re-run profile setup only (skip OS dependency installation)
alias refresh="SKIP_SETUP=1 curl -fsSL $BASH_PROFILE_CODE_REPO_RAW_URL/software/bootstrap/setup.sh?raw=1 | bash"
# upgrade: update OS packages + full setup with OS dependency installation
alias upgrade="update && curl -fsSL $BASH_PROFILE_CODE_REPO_RAW_URL/software/bootstrap/setup.sh?raw=1 | bash"

################################################################################
# ---- Update Notifier ----
# Checks if local bashrc clone is behind origin/master (at most once per day).
# Background fetch writes to a temp file; the next prompt displays it via
# _bashrc_update_check_show (avoids echoing from a background process, which
# collides with starship prompt rendering and causes blank-line hangs).
################################################################################
function _bashrc_update_check() {
  local repo_dir=""
  for _candidate in "$HOME/Downloads/bashrc" "$HOME/bashrc" "$HOME/.bashrc-repo"; do
    if [ -d "$_candidate/.git" ]; then
      repo_dir="$_candidate"
      break
    fi
  done
  [ -z "$repo_dir" ] && return

  # throttle: at most once per day
  local stamp_file="/tmp/.bashrc_update_check_stamp"
  if [ -f "$stamp_file" ]; then
    local stamp_age
    stamp_age=$(($(date +%s) - $(stat -c '%Y' "$stamp_file" 2> /dev/null || stat -f '%m' "$stamp_file" 2> /dev/null || echo 0)))
    [ "$stamp_age" -lt 86400 ] && return
  fi
  touch "$stamp_file"

  local msg_file="/tmp/.bashrc_update_check_msg"

  # fetch and compare (suppress all output from git)
  git -C "$repo_dir" fetch origin master --quiet 2> /dev/null || return
  local behind
  behind=$(git -C "$repo_dir" rev-list --count HEAD..origin/master 2> /dev/null)
  if [ -n "$behind" ] && [ "$behind" -gt 0 ]; then
    printf '\n  bashrc is %s commit(s) behind origin/master.\n  Run '\''cd %s && git pull'\'' or '\''make setup'\'' to update.\n\n' "$behind" "$repo_dir" > "$msg_file"
  fi
}
(_bashrc_update_check &) 2> /dev/null

# displays the update notification (written by the background check) on the next
# prompt, then removes the file so it only shows once.
function _bashrc_update_check_show() {
  local msg_file="/tmp/.bashrc_update_check_msg"
  if [ -f "$msg_file" ]; then
    command cat "$msg_file"
    rm -f "$msg_file"
  fi
}
PROMPT_COMMAND="_bashrc_update_check_show${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

################################################################################
# ---- Deferred Profile Blocks (heavy or late-loading) ----
# ---- Post-profile Integrations (registerWithBashSyleProfile) ----
################################################################################
# SOURCE | software/scripts/bash-keys.profile.bash
# SOURCE | software/scripts/bash-file-utils.profile.bash
# BEGIN/END | Fuzzy Filter Patterns
# SOURCE | software/scripts/bash-fzf.profile.bash
# SOURCE | software/scripts/advanced/editor-launchers-common.profile.bash
# BEGIN/END | Editor Launchers - Vim
# BEGIN/END | Editor Launchers - Sublime Text
# BEGIN/END | Editor Launchers - Sublime Merge
# BEGIN/END | Editor Launchers - VS Code
# BEGIN/END | Editor Launchers - Zed
# SOURCE | software/scripts/advanced/browser-launchers-common.profile.bash
# BEGIN/END | Browser Launchers - Brave
# BEGIN/END | Browser Launchers - Chrome
# BEGIN/END | Browser Launchers - Edge
# BEGIN/END | Browser Launchers - Chromium
# BEGIN/END | Browser Launchers - Vivaldi
# BEGIN/END | Browser Launchers - Opera
# BEGIN/END | Browser Launchers - Arc
# BEGIN/END | starship prompt
# BEGIN/END | zoxide init

################################################################################
# ---- Spec-based Autocomplete (bash-autocomplete-complete-spec.js) ----
################################################################################
# BEGIN/END | Spec Autocomplete
# SOURCE | software/scripts/bash-command-wrappers.profile.bash
# SOURCE | software/scripts/docker-shares.profile.bash

################################################################################
# ---- OS-specific Tweaks (registerPlatformTweaks) ----
################################################################################
# BEGIN/END | Android Termux OS-specific Tweaks
# BEGIN/END | Arch Linux OS-specific Tweaks
# BEGIN/END | ChromeOS OS-specific Tweaks
# BEGIN/END | Mac OS-specific Tweaks
# BEGIN/END | MinGW64 OS-specific Tweaks
# BEGIN/END | RedHat OS-specific Tweaks
# BEGIN/END | SteamOS OS-specific Tweaks
# BEGIN/END | Ubuntu OS-specific Tweaks
# BEGIN/END | WSL OS-specific Tweaks
# BEGIN/END | Windows OS-specific Tweaks
