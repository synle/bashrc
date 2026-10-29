#!/usr/bin/env bash

# software/bootstrap/profile-advanced.sh
################################################################################
# --- Early Profile Blocks (registerWithBashSyleProfile) ---
################################################################################

################################################################################
# --- History ---
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
  # the very commands the user types most. _rewrite_last_history_entry (defined below)
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

# Canonicalize a single history entry. Single canonicalizer used by both the
# hot path (_rewrite_last_history_entry via PROMPT_COMMAND) and the batch path
# (history_cleanup in bash-history.profile.bash).
#
# Pipeline (drop returns empty; rewrite returns canonical form):
#   1. trim leading/trailing whitespace
#   2. strip marker commands (clear|clean|br) in compound chains, both leading
#      and trailing — whitespace-tolerant so `clear;cmd`, `clear ; cmd`,
#      `cmd && clear`, etc. all collapse
#   3. drop bare markers
#   4. drop paste-residue patterns that bash -n can't catch (JSON/PowerShell
#      paste, JS brace fragments, hex bytes — see _PASTE_RESIDUE_PATTERNS)
#   5. expand ≤2-char aliases via BASH_ALIASES (g → git, n → npm, d → docker)
#   6. validate via `bash -nc` — drops invalid syntax (terminal corruption,
#      truncation, legacy multi-line splits)
#
# usage: _canonicalize_command "command string"
# echoes the canonical command on success; nothing on drop.
function _canonicalize_command() {
  local cmd="$1" first expansion pattern

  # 1. Trim leading/trailing whitespace
  cmd="${cmd#"${cmd%%[![:space:]]*}"}"
  cmd="${cmd%"${cmd##*[![:space:]]}"}"
  [ -z "$cmd" ] && return 0

  # 2. Strip marker commands in compound chains. Whitespace-tolerant — handles
  # `clear;cmd`, `clear ; cmd`, `clear && cmd`, `cmd;clear`, `cmd && clear`,
  # `; clear ; cmd`, and chained variants like `clear && clean && cmd`.
  local _HISTORY_MARKER_COMMANDS='clear|clean|br'
  while true; do
    # leading: optional leading `;`, marker, separator (`;` or `&&`), then rest
    if [[ "$cmd" =~ ^[[:space:]]*\;?[[:space:]]*(${_HISTORY_MARKER_COMMANDS})[[:space:]]*(\;|\&\&)[[:space:]]*(.+)$ ]]; then
      cmd="${BASH_REMATCH[3]}"
      continue
    fi
    # trailing: rest, separator, marker, optional trailing `;`
    if [[ "$cmd" =~ ^(.+[^[:space:]\;\&])[[:space:]]*(\;|\&\&)[[:space:]]*(${_HISTORY_MARKER_COMMANDS})[[:space:]]*\;?[[:space:]]*$ ]]; then
      cmd="${BASH_REMATCH[1]}"
      continue
    fi
    break
  done

  # 3. Bare marker (e.g. `clear` alone) — drop. HISTIGNORE normally filters
  # these, but catch the leftover-in-file case explicitly.
  if [[ "$cmd" =~ ^(${_HISTORY_MARKER_COMMANDS})$ ]]; then
    return 0
  fi

  # 4. Paste-residue drop filters. These patterns are valid command words to
  # `bash -n` but virtually never legitimate interactive bash — they come from
  # accidental paste of JSON/PowerShell/JS/Go source into the terminal. Order
  # matters only for performance (cheapest first).
  local _PASTE_RESIDUE_PATTERNS=(
    '^"'                                 # JSON/PowerShell leading quote
    '^\$'                                # PowerShell variable reference
    '\{$'                                # JS/TS/Go block-opener residue
    '^\}'                                # JS/TS/Go closing-brace residue
    '^0x[0-9A-Fa-f]'                     # C/Go/Python hex byte literal
    '^[A-Z][a-z][a-z]*-[A-Z]'            # PowerShell verb-noun cmdlet
    '^(try|catch|finally)[[:space:]]*\{' # JS try/catch/finally + brace
  )
  for pattern in "${_PASTE_RESIDUE_PATTERNS[@]}"; do
    [[ "$cmd" =~ $pattern ]] && return 0
  done

  # 5. First-word alias expansion: any ≤2-char alias resolves to its target via
  # BASH_ALIASES (bash 4+ associative array; on 3.2 subscript is arithmetic so skip).
  first="${cmd%% *}"
  if [ -n "$first" ] && [ ${#first} -le 2 ] && [ "${BASH_VERSINFO[0]:-0}" -ge 4 ]; then
    expansion="${BASH_ALIASES[$first]:-}"
    if [ -n "$expansion" ]; then
      if [ "$first" = "$cmd" ]; then
        cmd="$expansion"
      else
        cmd="$expansion ${cmd#"$first "}"
      fi
    fi
  fi

  [ -z "$cmd" ] && return 0

  # 6. Drop entries with invalid bash syntax (terminal corruption, truncation,
  # paste artifacts, legacy multi-line splits). Validates without executing
  # via `bash -nc`. Cheap (~1ms fork) — runs once per prompt for the last
  # entry, and on demand for full-history rewrites.
  bash -nc "$cmd" 2> /dev/null || return 0

  echo "$cmd"
}

# Rewrite the last history entry to a canonical form via _canonicalize_command.
# Combined with HISTCONTROL=erasedups, this gives a deduped history of canonical
# commands — `g status` and `git status` converge to one `git status` entry.
# Runs via PROMPT_COMMAND after every command; idempotent and skipped on
# bare-Enter (no new history entry).
function _rewrite_last_history_entry() {
  # Skip in non-interactive shells (bash -c, CI, syntax checks) — history
  # ops only work in interactive shells and would error in batch mode.
  case "$-" in *i*) ;; *) return 0 ;; esac
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

# prune a recents file, removing entries that fail the given test (-d or -f)
# usage: _prune_recents <file> <test_flag>
# tmp filename includes $$ (shell PID) so concurrent PROMPT_COMMAND runs across
# multiple terminals don't race on the same `<file>.tmp` — without the suffix,
# one shell's mv would consume the other's tmp and the second mv would surface
# `mv: <file>.tmp: No such file or directory` on the user's prompt.
function _prune_recents() {
  local file="$1" flag="$2" tmp="$1.tmp.$$"
  touch "$file"
  while IFS= read -r entry; do
    [ "$flag" "$entry" ] && echo "$entry"
  done < "$file" 2> /dev/null > "$tmp"
  [ -f "$tmp" ] && mv "$tmp" "$file"
}

# prepend stdin lines to a recents file (deduped, capped at max)
# usage: echo "entry" | _prepend_recents <file> <max>
# See _prune_recents for why tmp carries the $$ suffix.
function _prepend_recents() {
  local file="$1" max="$2" tmp="$1.tmp.$$"
  command cat - "$file" 2> /dev/null | awk '!seen[$0]++' | head -n "$max" > "$tmp"
  [ -f "$tmp" ] && mv "$tmp" "$file"
}

################################################################################
# --- Track Visited Directories ---
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
# Both recents lists live under the personal root, same as every other piece of
# Sy-owned state. The folder is created once here so _prune_recents' touch has
# somewhere to land; the -d test keeps the common case fork-free.
[ -d "$SY_ROOT_FOLDER" ] || command mkdir -p "$SY_ROOT_FOLDER" 2> /dev/null
_RECENT_FOLDERS_FILE="${SY_ROOT_FOLDER}/.bash_syle_paths"
_RECENT_FOLDERS_MAX=100
# exported so _recent_folders still resolves the file when fzf's F5 reload runs
# it inside a `$SHELL -c` subshell (see the export below)
export _RECENT_FOLDERS_FILE

# reads the folders file, removes entries that no longer exist, and outputs the cleaned list
function _recent_folders() {
  _prune_recents "$_RECENT_FOLDERS_FILE" -d
  command cat "$_RECENT_FOLDERS_FILE"
}
# exported because _fuzzy_cd_list calls it from fzf's F5 reload subshell, which
# runs through `$SHELL -c` and cannot see a non-exported shell function
export -f _recent_folders _prune_recents

# prepends the current directory to the folders file (deduped, capped at _RECENT_FOLDERS_MAX)
# skips home directory. runs automatically via PROMPT_COMMAND.
function _track_folder() {
  local current="$(pwd)"
  [ "$current" = "$HOME" ] && return
  # Skip if PWD unchanged since last track — eliminates 4 forks on every prompt
  [ "$current" = "${_LAST_TRACKED_PWD:-}" ] && return
  _LAST_TRACKED_PWD="$current"
  echo "$current" | _prepend_recents "$_RECENT_FOLDERS_FILE" "$_RECENT_FOLDERS_MAX"
}

# cd to the most recently visited directory
function last_folder() {
  if is_help_arg "${1:-}"; then
    echo "last_folder: cd to the last visited folder
  Usage: last_folder"
    return 0
  fi
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

# _windows_terminal_report_folder - Report the current folder for duplicate tabs/panes.
# No args; returns 0 and emits OSC 9;9 only for Windows Terminal WSL/MinGW sessions.
# Conversion failures retain converter stderr; unsafe/unavailable folders emit nothing.
function _windows_terminal_report_folder() {
  [ -n "${WT_SESSION:-}" ] || return 0
  local folder
  if ((is_os_wsl)); then
    type -P wslpath &> /dev/null || return 0
    folder=$(wslpath -w "$PWD") || return 0
  elif ((is_os_mingw64)); then
    type -P cygpath &> /dev/null || return 0
    folder=$(cygpath -w "$PWD") || return 0
  else
    return 0
  fi
  # A folder name must not terminate or inject a terminal control sequence.
  case "$folder" in
  "" | *[$'\001'-$'\037'$'\177']* | *\"*) return 0 ;;
  esac
  printf '\033]9;9;"%s"\033\\' "$folder"
}

# append history to file after every command (but do NOT clear+reload with -c/-r,
# so Up arrow navigates current tab's session history instead of showing commands
# from other tabs. Ctrl+R / fuzzy_history search the shared file for cross-tab history)
# Also force the terminal cursor back to a steady (non-blinking) block via
# DECSCUSR `\e[2 q` on every prompt — defends against shell integrations,
# plugins, or stray escape sequences that flip the cursor to a bar/beam.
_prompt_command_add "_rewrite_last_history_entry; _track_folder; history -a; _windows_terminal_report_folder; echo -ne '\\033]0;'\"\$(shorter_pwd_path)\"'\\007\\033[2 q'"

################################################################################
# --- Track Recent Files ---
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
_RECENT_FILES_FILE="${SY_ROOT_FOLDER}/.bash_syle_recent_files"
_RECENT_FILES_MAX=100

# reads the files list, removes entries that no longer exist, and outputs the cleaned list
function _recent_files() {
  _prune_recents "$_RECENT_FILES_FILE" -f
  command cat "$_RECENT_FILES_FILE"
}

# prepends the given file path(s) to the recent files list (deduped, capped at _RECENT_FILES_MAX)
function _track_file() {
  local arg full
  for arg in "$@"; do
    [ -f "$arg" ] || continue
    full=$(realpath "$arg" 2> /dev/null) || continue
    echo "$full"
  done | _prepend_recents "$_RECENT_FILES_FILE" "$_RECENT_FILES_MAX"
}

# open the most recently opened file with view_file
function last_file() {
  if is_help_arg "${1:-}"; then
    echo "last_file: open the most recently opened file
  Usage: last_file"
    return 0
  fi
  local f
  f=$(_recent_files | head -1)
  if [ -n "$f" ] && [ -f "$f" ]; then
    view_file "$f"
  else
    echo "last_file: no valid file found"
  fi
}

################################################################################
# --- Autocomplete Filters ---
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
# Append only entries not already present to avoid compounding on re-source
for _ce in "${ignored_commands[@]}"; do
  [[ ":${EXECIGNORE:-}:" == *":$_ce:"* ]] || EXECIGNORE="${EXECIGNORE:+$EXECIGNORE:}$_ce"
done
for _fe in "${ignored_files[@]}"; do
  [[ ":${FIGNORE:-}:" == *":$_fe:"* ]] || FIGNORE="${FIGNORE:+$FIGNORE:}$_fe"
done
export EXECIGNORE FIGNORE
unset ignored_commands cmd_string ignored_files file_string _ce _fe

################################################################################
# --- Shell Utilities ---
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
  local last_idx=$((${#args[@]} - 1))
  [ "$last_idx" -lt 0 ] && return 1
  local last="${args[$last_idx]}"
  if [[ "$last" == "--file" || "$last" == "--folder" || "$last" == "--exec" || "$last" == "--any" ]]; then
    mode="${last#--}"
    unset 'args[$last_idx]'
  fi
  local found=0
  # enable nullglob so unmatched globs expand to nothing instead of the
  # literal pattern string. Save original state to restore on exit.
  local _ng
  _ng=$(shopt -p nullglob) 2> /dev/null
  shopt -s nullglob
  for pattern in "${args[@]}"; do
    local matches=($pattern)
    if [[ "$mode" == "exec" ]]; then
      for p in "${matches[@]}"; do
        [[ -x "$p" ]] && echo "$p" && found=1
      done
    else
      [ "${#matches[@]}" -eq 1 ] || continue
      local p="${matches[0]}"
      case "$mode" in
      file) [ -f "$p" ] && echo "$p" && found=1 ;;
      folder) [ -d "$p" ] && echo "$p" && found=1 ;;
      *) [ -e "$p" ] && echo "$p" && found=1 ;;
      esac
    fi
  done
  eval "$_ng" # restore original nullglob state
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
        Returns 0 on yes or the affirmative default; 1 on no / EOF / no-tty.
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
  read -rp "$prompt $hint " reply < /dev/tty || return 1
  reply="$(echo "$reply" | tr '[:lower:]' '[:upper:]' | xargs)"

  if [ -z "$reply" ]; then
    case "$default" in [Yy]*) return 0 ;; esac
    return 1
  fi

  case "$reply" in Y | YES) return 0 ;; esac
  return 1
}

################################################################################
# --- HTTP / Networking Utilities ---
################################################################################

# Folder holding the per-day HAR archives written by the curl() wrapper below.
# One file per calendar day, named mm-dd-yyyy.har (HAR 1.2) — drop it into
# Chrome DevTools > Network > Import HAR, Firefox, Charles, or Insomnia.
export BASHRC_CURL_HAR_FOLDER="${BASHRC_CURL_HAR_FOLDER:-${SY_ROOT_FOLDER}/.curl_cache}"

# Wall-clock budget (seconds) a formatter gets before the wrapper gives up and
# prints the raw body instead. Keeps a wedged oxfmt/prettier from hanging a shell.
export BASHRC_CURL_FORMAT_TIMEOUT="${BASHRC_CURL_FORMAT_TIMEOUT:-5}"

# Largest response body (bytes) stored verbatim inside a HAR entry. Anything
# larger is truncated so one big download cannot dominate the day's archive.
export BASHRC_CURL_HAR_MAX_BODY="${BASHRC_CURL_HAR_MAX_BODY:-2000000}"

# Headers whose values are masked before an entry is written. HAR files are
# plain text sitting in $HOME — bearer tokens and session cookies do not belong
# in them. Space-delimited + lowercase; opt out with BASHRC_CURL_HAR_NO_REDACT=1.
export BASHRC_CURL_HAR_REDACTED_HEADERS="${BASHRC_CURL_HAR_REDACTED_HEADERS:- authorization proxy-authorization cookie set-cookie x-api-key x-auth-token x-csrf-token api-key }"

# _curl_run_timeout <seconds> <command...> - run a command under a wall-clock
# limit, returning the command's own exit code (124 when the limit is hit).
# Falls back to running it unbounded when neither `timeout` nor `gtimeout` is on
# PATH — stock macOS ships no coreutils `timeout`.
function _curl_run_timeout() {
  local secs="$1"
  shift

  if type -P timeout > /dev/null 2>&1; then
    command timeout "$secs" "$@"
  elif type -P gtimeout > /dev/null 2>&1; then
    command gtimeout "$secs" "$@"
  else
    "$@"
  fi
}

# _curl_json_str <value> - print <value> as a JSON string literal, surrounding
# quotes included. Pure bash, so it stays fork-free for the dozens of short
# header names and values a single HAR entry needs.
function _curl_json_str() {
  local s="${1-}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\n'/\\n}"
  printf '"%s"' "$s"
}

# _curl_json_body <file> - print the contents of <file> as a JSON string literal.
# Prefers jq / python3 / node because they are exact on arbitrary bytes and far
# faster than bash string replacement on a multi-megabyte body; falls back to a
# pure-bash escaper that strips the control characters JSON cannot carry.
function _curl_json_body() {
  local file="$1"
  local body

  if type -P jq > /dev/null 2>&1; then
    command jq -Rs . < "$file" && return 0
  elif type -P python3 > /dev/null 2>&1; then
    command python3 -c 'import json,sys; sys.stdout.write(json.dumps(sys.stdin.read()))' < "$file" && return 0
  elif type -P node > /dev/null 2>&1; then
    command node -e 'let d="";process.stdin.on("data",(c)=>{d+=c}).on("end",()=>{process.stdout.write(JSON.stringify(d))})' < "$file" && return 0
  fi

  body=$(command tr -d '\000-\010\013\014\016-\037' < "$file")
  _curl_json_str "$body"
}

# _curl_har_redact <header-name> - returns 0 when the named header's value must
# be masked before it lands in a HAR file.
function _curl_har_redact() {
  is_truthy "${BASHRC_CURL_HAR_NO_REDACT:-}" && return 1

  local name
  name=$(printf '%s' "${1-}" | command tr '[:upper:]' '[:lower:]')

  case "$BASHRC_CURL_HAR_REDACTED_HEADERS" in
  *" $name "*) return 0 ;;
  esac

  return 1
}

# _curl_har_header_entry <name> <value> - one HAR {"name":..,"value":..} object,
# with sensitive values masked.
function _curl_har_header_entry() {
  local name="$1"
  local value="$2"

  _curl_har_redact "$name" && value="[REDACTED]"

  printf '{"name":%s,"value":%s}' "$(_curl_json_str "$name")" "$(_curl_json_str "$value")"
}

# _curl_har_response_headers <dump-file> - turn a `curl -D` header dump into a
# HAR headers array. With -L the dump holds one block per redirect hop; only the
# final block is kept, since that is the response the body actually came from.
function _curl_har_response_headers() {
  local dump_file="$1"
  local line name value out=""

  if [ ! -s "$dump_file" ]; then
    printf '[]'
    return 0
  fi

  while IFS= read -r line; do
    line="${line%$'\r'}"
    case "$line" in
    HTTP/*)
      out=""
      continue
      ;;
    "")
      continue
      ;;
    esac

    name="${line%%:*}"
    [ "$name" = "$line" ] && continue
    value="${line#*:}"
    value="${value# }"

    [ -n "$out" ] && out="$out,"
    out="$out$(_curl_har_header_entry "$name" "$value")"
  done < "$dump_file"

  printf '[%s]' "$out"
}

# _curl_har_status_text <dump-file> - reason phrase from the final status line
# ("OK" for `HTTP/1.1 200 OK`). HTTP/2 and HTTP/3 dropped it, so "" is normal.
function _curl_har_status_text() {
  local dump_file="$1"
  local line rest text=""

  [ -s "$dump_file" ] || return 0

  while IFS= read -r line; do
    line="${line%$'\r'}"
    case "$line" in
    HTTP/*)
      rest="${line#* }"
      text="${rest#* }"
      [ "$text" = "$rest" ] && text=""
      ;;
    esac
  done < "$dump_file"

  printf '%s' "$text"
}

# _curl_har_method <curl args...> - HTTP method the request will use. An explicit
# -X/--request wins, a body flag implies POST, everything else is GET.
function _curl_har_method() {
  local arg prev="" method="" has_body=0

  for arg in "$@"; do
    case "$prev" in
    -X | --request) method="$arg" ;;
    esac

    case "$arg" in
    --request=*) method="${arg#--request=}" ;;
    -X?*) method="${arg#-X}" ;;
    -d | --data | --data-raw | --data-binary | --data-urlencode | -F | --form) has_body=1 ;;
    --data=* | --data-raw=* | --data-binary=* | --data-urlencode=* | --form=*) has_body=1 ;;
    -d?*) has_body=1 ;;
    esac

    prev="$arg"
  done

  if [ -z "$method" ]; then
    method="GET"
    ((has_body)) && method="POST"
  fi

  printf '%s' "$method"
}

# _curl_har_request_headers <curl args...> - HAR headers array built from the
# -H/--header flags the caller passed. curl's implicit defaults (User-Agent,
# Accept, Host) are invisible to the wrapper, so they are not recorded.
function _curl_har_request_headers() {
  local arg prev="" header name value out=""

  for arg in "$@"; do
    header=""

    case "$prev" in
    -H | --header) header="$arg" ;;
    esac

    case "$arg" in
    --header=*) header="${arg#--header=}" ;;
    esac

    prev="$arg"

    [ -n "$header" ] || continue
    name="${header%%:*}"
    [ "$name" = "$header" ] && continue
    value="${header#*:}"
    value="${value# }"

    [ -n "$out" ] && out="$out,"
    out="$out$(_curl_har_header_entry "$name" "$value")"
  done

  printf '[%s]' "$out"
}

# _curl_har_ms <seconds> [minus-seconds] - curl reports timings in fractional
# seconds; HAR wants milliseconds. Negative results clamp to 0.
function _curl_har_ms() {
  command awk -v a="${1:-0}" -v b="${2:-0}" 'BEGIN { d = (a - b) * 1000; if (d < 0) d = 0; printf "%.2f", d }'
}

# _curl_har_started_at - current time as an ISO 8601 stamp with a colon in the
# UTC offset, which is the shape HAR viewers expect (2026-08-02T10:18:00.000-07:00).
function _curl_har_started_at() {
  printf '%s.000%s' \
    "$(command date +%Y-%m-%dT%H:%M:%S)" \
    "$(command date +%z | command sed 's/\(..\)$/:\1/')"
}

# _curl_har_append <entry-json> - append one entry to today's HAR archive at
# $BASHRC_CURL_HAR_FOLDER/mm-dd-yyyy.har.
#
# The archive is kept in an append-friendly shape: the opening object on line 1,
# exactly one entry per line after it, and a bare `]}}` terminator on the last
# line. Appending is then "drop the terminator, add a line, re-add the
# terminator" — no JSON parser, and no need to hold the whole archive in memory.
# The write lands in a temp file and is moved into place, so an interrupted curl
# can never leave a half-written archive behind.
function _curl_har_append() {
  local entry="$1"
  local folder har_file tmp_har prefix="" line_above

  folder="${BASHRC_CURL_HAR_FOLDER:-${SY_ROOT_FOLDER}/.curl_cache}"
  command mkdir -p "$folder" || return 1

  har_file="$folder/$(command date +%m-%d-%Y).har"
  tmp_har="$har_file.tmp.$$"

  # A last line that is not the terminator means the archive was truncated or
  # hand-edited. Move it aside instead of appending onto invalid JSON.
  if [ -s "$har_file" ] && [ "$(command tail -n 1 "$har_file")" != ']}}' ]; then
    command mv "$har_file" "$har_file.corrupt.$(command date +%H%M%S)" || return 1
  fi

  if [ -s "$har_file" ]; then
    # The header line is the only line ending in `[`; entry lines all end in `}`.
    line_above=$(command tail -n 2 "$har_file" | command head -n 1)
    case "$line_above" in
    *'[') prefix="" ;;
    *) prefix="," ;;
    esac
    command sed '$d' "$har_file" > "$tmp_har" || return 1
  else
    printf '%s\n' '{"log":{"version":"1.2","creator":{"name":"bashrc-curl","version":"1.0"},"pages":[],"entries":[' > "$tmp_har" || return 1
  fi

  printf '%s%s\n]}}\n' "$prefix" "$entry" >> "$tmp_har" || return 1

  command mv "$tmp_har" "$har_file" || {
    command rm -f "$tmp_har"
    return 1
  }

  return 0
}

# _curl_har_record <started-at> <method> <body-file> <dump-file> <req-headers-json> <stats>
# Build one HAR 1.2 entry from a completed request and append it to today's
# archive. <stats> is the newline-separated `curl -w` payload, in order:
#   http_code, time_total, time_starttransfer, size_download, content_type,
#   url_effective, http_version
# Newline-separated rather than tab-separated on purpose: bash collapses runs of
# IFS whitespace, so an empty Content-Type would silently shift every later field.
function _curl_har_record() {
  local started_at="$1"
  local method="$2"
  local body_file="$3"
  local dump_file="$4"
  local request_headers="$5"
  local stats="$6"

  local code total start size mime url httpver
  {
    read -r code
    read -r total
    read -r start
    read -r size
    read -r mime
    read -r url
    read -r httpver
  } <<< "$stats"

  case "$code" in '' | *[!0-9]*) code=0 ;; esac
  case "$size" in '' | *[!0-9]*) size=0 ;; esac
  [ -n "$mime" ] || mime="application/octet-stream"
  [ -n "$httpver" ] || httpver="1.1"

  local max_body="${BASHRC_CURL_HAR_MAX_BODY:-2000000}"
  case "$max_body" in '' | *[!0-9]*) max_body=2000000 ;; esac

  local body_json="" comment='""' clipped=""

  if [ ! -s "$body_file" ]; then
    body_json='""'
  elif [ "$size" -gt "$max_body" ]; then
    clipped=$(command mktemp) || return 1
    command head -c "$max_body" "$body_file" > "$clipped" 2> /dev/null
    body_json=$(_curl_json_body "$clipped")
    command rm -f "$clipped"
    comment='"body truncated by BASHRC_CURL_HAR_MAX_BODY"'
  else
    body_json=$(_curl_json_body "$body_file")
  fi

  [ -n "$body_json" ] || body_json='""'

  local entry
  entry=$(
    printf '{"startedDateTime":%s,"time":%s,"request":{"method":%s,"url":%s,"httpVersion":%s,"cookies":[],"headers":%s,"queryString":[],"headersSize":-1,"bodySize":-1},"response":{"status":%s,"statusText":%s,"httpVersion":%s,"cookies":[],"headers":%s,"content":{"size":%s,"mimeType":%s,"text":%s,"comment":%s},"redirectURL":"","headersSize":-1,"bodySize":%s},"cache":{},"timings":{"send":0,"wait":%s,"receive":%s}}' \
      "$(_curl_json_str "$started_at")" \
      "$(_curl_har_ms "$total")" \
      "$(_curl_json_str "$method")" \
      "$(_curl_json_str "$url")" \
      "$(_curl_json_str "HTTP/$httpver")" \
      "$request_headers" \
      "$code" \
      "$(_curl_json_str "$(_curl_har_status_text "$dump_file")")" \
      "$(_curl_json_str "HTTP/$httpver")" \
      "$(_curl_har_response_headers "$dump_file")" \
      "$size" \
      "$(_curl_json_str "$mime")" \
      "$body_json" \
      "$comment" \
      "$size" \
      "$(_curl_har_ms "$start")" \
      "$(_curl_har_ms "$total" "$start")"
  )

  _curl_har_append "$entry"
}

# curl drop-in: pretty-prints structured responses and archives every buffered
# request into a per-day HAR file.
function curl() {
  # Show wrapper help.
  if is_help_arg "${1:-}"; then
    command cat << 'EOF'
curl: drop-in curl wrapper that pretty-prints responses and records a daily HAR

Usage:
  curl <url> [flags...]

Formatting:
  Detects format from:
    1. Response body shape
    2. URL extension

Supported formats:
  JSON       { ... } / [ ... ] / .json      (oxfmt)
  HTML       < ... > / .html / .htm / .xml / .svg   (oxfmt)
  JS         .js / .mjs / .cjs / .jsx       (oxfmt)
  TS         .ts / .tsx                     (oxfmt)
  CSS        .css / .scss / .less           (oxfmt)
  Markdown   .md / .markdown                (prettier)
  YAML       .yml / .yaml                   (prettier)

HAR capture:
  Every buffered request is appended to a HAR 1.2 archive, one file per day:
    $BASHRC_CURL_HAR_FOLDER/mm-dd-yyyy.har
  Import it into Chrome DevTools > Network > Import HAR, Firefox, Charles, or
  Insomnia. Sensitive header values (Authorization, Cookie, ...) are masked.

Always adds:
  -L (follow redirects)

Environment:
  BASHRC_CURL_NO_CACHE=1            add no-cache request headers
  BASHRC_CURL_NO_HAR=1              disable HAR capture
  BASHRC_CURL_HAR_FOLDER=<folder>   where daily HAR files are written
  BASHRC_CURL_HAR_MAX_BODY=<bytes>  truncate bodies larger than this in the HAR
  BASHRC_CURL_HAR_NO_REDACT=1       store sensitive header values verbatim
  BASHRC_CURL_FORMAT_TIMEOUT=<sec>  formatter budget before falling back to raw

Falls back to plain curl (no formatting, no HAR) when:
  - stdout is redirected/piped
  - output/download flags are used (-o, -O, -i, -I, -D, -T, -w, ...)
  - a temp file cannot be created

Falls back to the raw body when:
  - the format cannot be detected
  - the formatter errors or runs past BASHRC_CURL_FORMAT_TIMEOUT seconds

curl https://httpbin.org/json
curl https://jsonplaceholder.typicode.com/todos/1
curl https://raw.githubusercontent.com/git/git/master/README.md
EOF
    return 0
  fi

  # Default curl flags.
  local curl_flags=(-L)

  # Optional no-cache headers.
  local cache_headers=()

  if is_truthy "${BASHRC_CURL_NO_CACHE:-}"; then
    cache_headers=(
      -H 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0'
      -H 'Pragma: no-cache'
      -H 'Expires: 0'
      -H 'If-None-Match:'
      -H 'If-Modified-Since:'
    )
  fi

  # Nested on purpose: it reads curl_flags/cache_headers from this call frame.
  function _curl_raw() {
    command curl "${curl_flags[@]}" "${cache_headers[@]}" "$@"
  }

  # Preserve streaming behavior.
  [ -t 1 ] || {
    _curl_raw "$@"
    return
  }

  # Preserve normal curl output/download behavior.
  local arg

  for arg in "$@"; do
    case "$arg" in
    -o | --output | \
      -O | --remote-name | --remote-name-all | \
      -J | --remote-header-name | \
      -i | --include | \
      -I | --head | \
      -D | --dump-header | \
      -T | --upload-file | \
      -w | --write-out | \
      --output-dir)
      _curl_raw "$@"
      return
      ;;
    esac
  done

  # Capture response body, headers and transfer stats.
  local tmpfile
  tmpfile=$(command mktemp) || {
    _curl_raw "$@"
    return
  }

  local header_file="$tmpfile.headers"
  local formatted_file=""

  trap 'command rm -f "$tmpfile" "$header_file" "$formatted_file"' RETURN

  local started_at
  started_at=$(_curl_har_started_at)

  local curl_stats

  curl_stats=$(
    command curl \
      -sS \
      "${curl_flags[@]}" \
      "${cache_headers[@]}" \
      "$@" \
      -o "$tmpfile" \
      -D "$header_file" \
      -w '%{http_code}\n%{time_total}\n%{time_starttransfer}\n%{size_download}\n%{content_type}\n%{url_effective}\n%{http_version}'
  )

  local rc=$?
  local http_code="${curl_stats%%$'\n'*}"

  # Archive the exchange. A HAR failure must never change what curl prints, so
  # its output is discarded and its exit code ignored.
  if ! is_truthy "${BASHRC_CURL_NO_HAR:-}"; then
    _curl_har_record \
      "$started_at" \
      "$(_curl_har_method "$@")" \
      "$tmpfile" \
      "$header_file" \
      "$(_curl_har_request_headers "${cache_headers[@]}" "$@")" \
      "$curl_stats" > /dev/null 2>&1
  fi

  if [ ! -s "$tmpfile" ]; then
    echo "(empty body; http ${http_code:-?}, curl exit $rc)" >&2
    return "$rc"
  fi

  # ---------------------------------------------------------------------------
  # Detect format
  # ---------------------------------------------------------------------------
  local format=""
  local first_char last_char

  first_char=$(command head -c 256 "$tmpfile" | command tr -d '[:space:]' | command head -c 1)
  last_char=$(command tail -c 256 "$tmpfile" | command tr -d '[:space:]' | command tail -c 1)

  case "$first_char$last_char" in
  "{}" | "[]") format="json" ;;
  "<>") format="html" ;;
  esac

  # URL extension fallback.
  if [ -z "$format" ]; then
    local url="" ext=""

    for arg in "$@"; do
      case "$arg" in
      http://* | https://* | file://*) url="$arg" ;;
      esac
    done

    if [ -n "$url" ]; then
      ext="${url%%\?*}"
      ext="${ext%%#*}"
      ext="${ext##*.}"
      # `${ext,,}` would be cleaner but is bash 4+; macOS still ships bash 3.2.
      ext=$(printf '%s' "$ext" | command tr '[:upper:]' '[:lower:]')

      case "$ext" in
      json) format="json" ;;
      js | mjs | cjs | jsx) format="javascript" ;;
      ts | tsx) format="typescript" ;;
      css | scss | less) format="css" ;;
      html | htm | xml | svg) format="html" ;;
      md | markdown) format="markdown" ;;
      yml | yaml) format="yaml" ;;
      esac
    fi
  fi

  # ---------------------------------------------------------------------------
  # Format dispatch
  # ---------------------------------------------------------------------------
  local formatter="" extension=""
  local formatter_flags=()

  case "$format" in
  json) formatter="oxfmt" extension="json" ;;
  javascript) formatter="oxfmt" extension="js" ;;
  typescript) formatter="oxfmt" extension="ts" ;;
  css) formatter="oxfmt" extension="css" ;;
  html) formatter="oxfmt" extension="html" ;;
  # oxfmt still mangles these two, so they stay on prettier.
  markdown)
    formatter="prettier" extension="md"
    formatter_flags=(--write)
    ;;
  yaml)
    formatter="prettier" extension="yaml"
    formatter_flags=(--write)
    ;;
  esac

  if [ -z "$formatter" ]; then
    command cat "$tmpfile"
    return "$rc"
  fi

  # `timeout` execs the real binary, which bypasses the auto-installing oxfmt()
  # and prettier() wrappers — make sure the binary is on PATH before dispatching.
  if ! type -P "$formatter" > /dev/null 2>&1 && ! _ensure_npm_binary "$formatter"; then
    command cat "$tmpfile"
    return "$rc"
  fi

  # Both formatters rewrite in place, so work on a copy whose extension tells
  # them which parser to use.
  formatted_file="$tmpfile.$extension"

  command cp "$tmpfile" "$formatted_file" || {
    command cat "$tmpfile"
    return "$rc"
  }

  if _curl_run_timeout "${BASHRC_CURL_FORMAT_TIMEOUT:-5}" \
    "$formatter" "${formatter_flags[@]}" "$formatted_file" > /dev/null 2>&1; then
    command cat "$formatted_file"
  else
    # Formatter errored, choked on the payload, or blew the timeout — the raw
    # body always beats printing nothing.
    command cat "$tmpfile"
  fi

  return "$rc"
}

# _ensure_npm_binary <pkg> [binary] - make sure <binary> is on PATH, offering to
# install <pkg> globally into ~/.local when it is not.
#
# Profile-side mirror of the function in software/bootstrap/common-functions.bash.
# The profile is sourced on every interactive shell startup, so it cannot SOURCE
# common-functions.bash; the install step is also deliberately simpler here (a
# plain `npm install -g --prefix`) because the full npm_install_global depends on
# setup-run state — BASHRC_TEMP_DIR, IS_FORCE_REFRESH, the WSL/native-arch
# helpers — that an interactive shell does not have.
function _ensure_npm_binary() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # Already installed.
  if type -P "$bin" > /dev/null 2>&1; then
    return 0
  fi

  # npm is required for bootstrapping.
  if ! type -P npm > /dev/null 2>&1; then
    echo "$bin wrapper: npm not found on PATH; cannot bootstrap $bin" >&2
    return 127
  fi

  # Ask before installing.
  if ! prompt_yes_no "$bin not installed. Install via npm?"; then
    echo "$bin wrapper: install declined by user" >&2
    return 1
  fi

  command npm install -g --prefix "$HOME/.local" "$pkg" || return 1

  if ! type -P "$bin" > /dev/null 2>&1; then
    echo "$bin wrapper: install completed but '$bin' is still not on PATH" >&2
    return 1
  fi

  return 0
}

################################################################################
# --- Aliases: Navigation ---
################################################################################
alias ..="cd .."
alias ...="cd ../../"
alias ....="cd ../../../"
alias clear='printf "\033[H\033[2J\033[3J"'

# cd: change folders with native Bash behavior and bounded nearby-folder matching.
# Args: native cd operands. Missing paths search from their longest existing folder prefix.
# Returns native status or 1 on search/selection failure; fuzzy moves print a summary and may prompt.
function cd() {
  if [ "$#" -eq 0 ]; then
    builtin cd
    return $?
  fi
  if [ "$#" -ne 1 ]; then
    builtin cd "$@"
    return $?
  fi

  local _cd_query="$1"
  case "$_cd_query" in
  "" | - | -*)
    builtin cd "$@"
    return $?
    ;;
  esac

  # Probe native navigation first so CDPATH, symlinks, options, and exact paths keep Bash semantics.
  if (builtin cd "$_cd_query" > /dev/null 2>&1); then
    builtin cd "$_cd_query"
    return $?
  fi
  if [ -e "$_cd_query" ] || [ -L "$_cd_query" ]; then
    builtin cd "$@"
    return $?
  fi

  if is_help_arg "$_cd_query"; then
    echo "cd: change folders with native Bash behavior and bounded nearby-folder matching
  Usage: cd [folder]
  Exact paths and Bash options keep native behavior.
  Missing paths search from their longest existing folder prefix.
  Search covers up to 3 folder levels for 2 seconds.
  Ambiguous matches require terminal stdin and a controlling terminal for selection."
    return 0
  fi

  if [ -z "${_IGNORED_FOLDERS_JSON:-}" ] || ! type -P node > /dev/null 2>&1; then
    builtin cd "$@"
    return $?
  fi

  local _cd_node_script _cd_results _cd_status _cd_encoded _cd_decoded _cd_relative _cd_choice _cd_index _cd_target _cd_display
  local _cd_search_folder="." _cd_search_absolute="$PWD" _cd_search_query="$_cd_query" _cd_prefix="$_cd_query"
  local -a _cd_matches=()

  # Let Bash resolve existing parents (including .. and symlinks); only missing names need fuzzy matching.
  while [[ "$_cd_prefix" = */* ]]; do
    _cd_prefix="${_cd_prefix%/*}"
    [ -n "$_cd_prefix" ] || _cd_prefix="/"
    if _cd_decoded=$(builtin cd -- "$_cd_prefix" > /dev/null 2>&1 && printf '%s\001' "$PWD"); then
      _cd_search_folder="${_cd_decoded%$'\001'}"
      _cd_search_absolute="$_cd_search_folder"
      _cd_search_query="${_cd_query#"$_cd_prefix"}"
      _cd_search_query="${_cd_search_query#/}"
      break
    fi
    [ "$_cd_prefix" != "/" ] || break
  done

  IFS= read -r -d '' _cd_node_script << 'CD_NODE' || true
const fs = require('fs');
const path = require('path');
const query = process.argv[1];
const MAX_DEPTH = 3;
const MAX_ENTRIES = 20000;
const TIMEOUT_MS = 2000;
const deadlineTimer = setTimeout(() => {
  process.stderr.write('cd: fuzzy folder search timed out\n');
  process.exit(124);
}, TIMEOUT_MS);
function stop(message) {
  clearTimeout(deadlineTimer);
  process.stderr.write(`cd: fuzzy folder search ${message}\n`);
  process.exitCode = 1;
}
function queryParts(value) {
  const normalized = value.replace(/^(?:\.\/)+/, '');
  const parts = normalized.split('/');
  if (!normalized || parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts;
}
function matchScore(parts, requested) {
  const segmented = requested.length > 1;
  const indexes = segmented ? requested.map((_, index) => index) : parts.map((_, index) => index);
  let worst = 0;
  let total = 0;
  let extra = 0;
  let found = false;
  for (const index of indexes) {
    if (!segmented && parts[index].toLowerCase().includes(requested[0].toLowerCase())) {
      found = true;
      const name = parts[index].toLowerCase();
      const term = requested[0].toLowerCase();
      const rank = name === term ? 0 : name.startsWith(term) ? 1 : 2;
      worst = Math.max(worst, rank);
      total += rank;
      extra += name.length - term.length;
      continue;
    }
    if (segmented) {
      const name = (parts[index] || '').toLowerCase();
      const term = requested[index].toLowerCase();
      if (!name.includes(term)) return null;
      found = true;
      const rank = name === term ? 0 : name.startsWith(term) ? 1 : 2;
      worst = Math.max(worst, rank);
      total += rank;
      extra += name.length - term.length;
    }
  }
  return found ? [worst, total, extra] : null;
}
function isIgnored(parts, requested, patterns) {
  for (let index = 0; index < parts.length; index += 1) {
    const prefix = `${parts.slice(0, index + 1).join('/')}/`;
    const segmentStart = prefix.length - parts[index].length - 1;
    const ignored = patterns.some((pattern) => {
      pattern.lastIndex = 0;
      const match = pattern.exec(prefix);
      return match && match.index + match[0].length > segmentStart;
    });
    if (!ignored) continue;
    if (requested.length > 1 && requested[index] === parts[index]) continue;
    return true;
  }
  return false;
}
(async () => {
  let requested;
  let patterns;
  try {
    requested = queryParts(query);
    const rawPatterns = JSON.parse(process.env._IGNORED_FOLDERS_JSON);
    if (!Array.isArray(rawPatterns) || rawPatterns.length === 0 || rawPatterns.some((pattern) => typeof pattern !== 'string')) {
      throw new Error('shared ignored-folder rules are not a non-empty string array');
    }
    patterns = rawPatterns.map((pattern) => new RegExp(pattern));
  } catch {
    stop('could not load shared ignored-folder rules');
    return;
  }
  if (!requested) {
    clearTimeout(deadlineTimer);
    process.exitCode = 1;
    return;
  }
  let entriesVisited = 0;
  let level = [{ absolute: process.cwd(), parts: [] }];
  for (let depth = 1; depth <= MAX_DEPTH && level.length; depth += 1) {
    const next = [];
    const matches = [];
    for (const parent of level) {
      let entries;
      try {
        entries = await fs.promises.readdir(parent.absolute, { withFileTypes: true });
      } catch {
        stop('could not read a nearby folder');
        return;
      }
      for (const entry of entries) {
        entriesVisited += 1;
        if (entriesVisited > MAX_ENTRIES) {
          stop(`reached its ${MAX_ENTRIES}-entry safety limit`);
          return;
        }
        if (!entry.isDirectory()) continue;
        const parts = [...parent.parts, entry.name];
        if (isIgnored(parts, requested, patterns)) continue;
        const score = matchScore(parts, requested);
        if (score) matches.push({ parts, score, relative: parts.join('/') });
        if (depth < MAX_DEPTH) next.push({ absolute: path.join(parent.absolute, entry.name), parts });
      }
    }
    if (matches.length) {
      matches.sort((left, right) => left.score[0] - right.score[0] || left.score[1] - right.score[1] || left.score[2] - right.score[2] || left.relative.localeCompare(right.relative));
      for (const match of matches.slice(0, 5)) process.stdout.write(`${Buffer.from(match.relative).toString('base64')}\n`);
      clearTimeout(deadlineTimer);
      return;
    }
    level = next;
  }
  clearTimeout(deadlineTimer);
})().catch((error) => stop(`failed: ${error.message}`));
CD_NODE

  _cd_results=$(builtin cd -- "$_cd_search_folder" > /dev/null && command node -e "$_cd_node_script" "$_cd_search_query")
  _cd_status=$?
  [ "$_cd_status" -eq 0 ] || return 1
  while IFS= read -r _cd_encoded; do
    [ -n "$_cd_encoded" ] && _cd_matches+=("$_cd_encoded")
  done <<< "$_cd_results"

  if [ "${#_cd_matches[@]}" -eq 0 ]; then
    builtin cd "$@"
    return $?
  fi

  if [ "${#_cd_matches[@]}" -eq 1 ]; then
    _cd_encoded="${_cd_matches[0]}"
  else
    if [ ! -t 0 ] || ! { : < /dev/tty > /dev/tty; } 2> /dev/null; then
      echo "cd: multiple nearby folders match; terminal stdin and a controlling terminal are required to choose one" >&2
      return 1
    fi
    printf 'Your keyword matches multiple paths. Choose 1-5 or enter a full path:\n' > /dev/tty
    for _cd_index in "${!_cd_matches[@]}"; do
      _cd_decoded=$(command node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString() + String.fromCharCode(1))' "${_cd_matches[$_cd_index]}") || return 1
      _cd_relative="${_cd_decoded%$'\001'}"
      printf -v _cd_display '%q' "${_cd_search_folder%/}/$_cd_relative"
      printf '%s %s\n' "$((_cd_index + 1))" "$_cd_display" > /dev/tty
    done
    if ! IFS= read -r _cd_choice < /dev/tty; then
      echo "cd: folder selection cancelled" >&2
      return 1
    fi
    case "$_cd_choice" in
    [1-5])
      _cd_index=$((_cd_choice - 1))
      if [ "$_cd_index" -ge "${#_cd_matches[@]}" ]; then
        echo "cd: selection is outside the displayed choices" >&2
        return 1
      fi
      _cd_encoded="${_cd_matches[$_cd_index]}"
      ;;
    *)
      _cd_encoded=""
      for _cd_index in "${!_cd_matches[@]}"; do
        _cd_decoded=$(command node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString() + String.fromCharCode(1))' "${_cd_matches[$_cd_index]}") || return 1
        _cd_relative="${_cd_decoded%$'\001'}"
        printf -v _cd_display '%q' "${_cd_search_folder%/}/$_cd_relative"
        if [ "$_cd_choice" = "$_cd_display" ] || [ "$_cd_choice" = "${_cd_search_folder%/}/$_cd_relative" ] || [ "$_cd_choice" = "${_cd_search_absolute%/}/$_cd_relative" ]; then
          _cd_encoded="${_cd_matches[$_cd_index]}"
          break
        fi
      done
      if [ -z "$_cd_encoded" ]; then
        echo "cd: selection must be 1-5 or a displayed full path" >&2
        return 1
      fi
      ;;
    esac
  fi

  _cd_decoded=$(command node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString() + String.fromCharCode(1))' "$_cd_encoded") || return 1
  _cd_relative="${_cd_decoded%$'\001'}"
  _cd_target="${_cd_search_folder%/}/$_cd_relative"
  print_action_summary "$_cd_target"
  builtin cd -- "$_cd_target"
}

# --- find (fd wrapper) ---
# `fd` is guaranteed on PATH by ensure_binary_alias (apt's fd-find installs as
# fdfind; we symlink $HOME/.local/bin/fd). Other distros ship `fd` directly.
type -P fd &> /dev/null && alias f='fd'

# --- Aliases: Editors / Tools ---
alias bs="bash"
alias vi="vim"
alias v="vim"
alias c="command cat"
# --- Aliases: Git ---
# git: default diffs to -w and a bare stash to -u; preserve native arguments and exit status.
# Accepts Git global options and subcommands. Explicit stash operations stay unchanged.
# Mutations invalidate the branch cache; command git bypasses these shell defaults.
function git() {
  local _git_args=("$@") _git_index=0 _git_command
  while [ "$_git_index" -lt "${#_git_args[@]}" ]; do
    case "${_git_args[$_git_index]}" in
    -c | -C | --git-dir | --work-tree | --namespace | --config-env)
      _git_index=$((_git_index + 2))
      ;;
    -*) _git_index=$((_git_index + 1)) ;;
    *) break ;;
    esac
  done
  _git_command="${_git_args[$_git_index]-}"
  if [ "$_git_command" = diff ]; then
    _git_args=("${_git_args[@]:0:$_git_index}" diff -w "${_git_args[@]:$((_git_index + 1))}")
  elif [ "$_git_command" = stash ] && [ "$#" -eq "$((_git_index + 1))" ]; then
    _git_args=("${_git_args[@]:0:$_git_index}" stash push -u)
  fi
  command git "${_git_args[@]}"
  local _git_exit=$?
  # Invalidate git branch cache on state-changing commands (write/subcommand groups only).
  # Collapsed from six identical branches into one pattern list.
  case "${_git_command%2}" in
  checkout | switch | pull | push | fetch | merge | rebase | commit | reset | \
    stash | cherry-pick | revert | am | apply | \
    c | cm | amend | amendm | wip | unwip | aac | auc | \
    co | cob | del | gone | \
    p | pu | po | pof | fap | fapr | track | \
    r | rc | ri | rv | rvc | mc | cp | cpc | cpn | \
    undo | cleanfd | patch)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  esac
  return $_git_exit
}
alias g="git"
alias gg="git --no-pager"

# --- Aliases: Editors ---
alias z="zed"

# --- Aliases: Node ---
alias n="node"
alias y="yarn"
alias a_node="activate_node"

# --- Aliases: Python ---
alias a_py="activate_py"
alias pytest="python -m pytest"
alias pytest-single="python -m pytest -vvl -k"
alias flake="flake8"
alias flake8="python -m flake8"

# --- Document Conversion ---
if type -P uvx > /dev/null 2>&1; then
  # markitdown: install or convert documents to Markdown with optional output file.
  # With no arguments, installs the tool; otherwise accepts native CLI arguments or INPUT OUTPUT.
  # Returns uv/uvx status; one-input conversions cache Markdown in /tmp before printing it.
  function markitdown() {
    if is_help_arg "${1:-}"; then
      echo "markitdown: install or convert documents to Markdown with optional output file
  Usage:
    markitdown INPUT
    markitdown INPUT -o OUTPUT.md
    markitdown INPUT OUTPUT.md
    cat INPUT | markitdown
    markitdown < INPUT

  Examples:
    markitdown report.pdf
    markitdown report.docx report.md
    markitdown report.xlsx -o report.md
    markitdown report.pdf > report.md
    cat report.pdf | markitdown -x pdf

  Input:
    Supports common PDF, Office, HTML, CSV, JSON, image, audio, and archive files.
    Use -x/--extension, -m/--mime-type, or -c/--charset for stdin hints.

  Output:
    With one INPUT and no options, saves to /tmp/YYYY_MM_DD_HH_MM_SS-markitdown-XXXXXX.md,
    prints the saved file path to stderr, then writes the file content to stdout.
    Without -o/--output in other forms, writes Markdown to stdout.
    With -o/--output OUTPUT, writes Markdown to OUTPUT.
    Two plain arguments mean INPUT OUTPUT and become INPUT -o OUTPUT.

  Options:
    -h, --help                 Show this help.
    -v, --version              Show MarkItDown version.
    -o, --output OUTPUT        Write Markdown to OUTPUT instead of stdout.
    -x, --extension EXTENSION  Hint input extension, useful with stdin.
    -m, --mime-type MIME       Hint input MIME type, useful with stdin.
    -c, --charset CHARSET      Hint input charset, for example UTF-8.
    -p, --use-plugins          Enable installed third-party plugins.
        --list-plugins         List installed third-party plugins.
        --keep-data-uris       Keep base64/data URIs in output.

  Installation:
    markitdown with no arguments installs markitdown[all] with Python 3.12.
    First conversion may download packages through uvx and take a while.
    MarkItDown runs through uvx, so no permanent global install is required."
      return 0
    fi
    if [ "$#" -eq 0 ]; then
      command uv tool install --python 3.12 "markitdown[all]"
      return
    fi
    if [ "$#" -eq 2 ] && [[ "$1" != -* && "$2" != -* ]]; then
      set -- "$1" -o "$2"
    fi
    if [ "$#" -eq 1 ] && [[ "$1" != -* ]]; then
      local temp_file output_file exit_code
      temp_file=$(command mktemp "/tmp/$(command date +%Y_%m_%d_%H_%M_%S)-markitdown-XXXXXX") || return 1
      output_file="${temp_file}.md"
      command mv "$temp_file" "$output_file" || return 1
      command uvx --python 3.12 --from "markitdown[all]" markitdown "$1" -o "$output_file"
      exit_code=$?
      [ "$exit_code" -eq 0 ] || return "$exit_code"
      printf '>> MarkItDown output: %s\n' "$output_file" >&2
      command cat "$output_file"
      return $?
    fi
    command uvx --python 3.12 --from "markitdown[all]" markitdown "$@"
  }
fi

# --- Aliases: Git ---
alias stash="git stash"
alias pop="git stash pop"
alias amend="git amend"

# --- LLM Prompt History (shared) ---
# SOURCE | software/scripts/advanced/llm/_common/llm-prompts.profile.bash

# --- sy-* slash command dispatchers (shared) ---
# SOURCE | software/scripts/advanced/llm/_common/sy-commands.profile.bash

# --- Ollama Performance ---
# Sourced ahead of the per-CLI partials below: it is the single place that defines
# OLLAMA_DEFAULT_SERVER_PORT / OLLAMA_DEFAULT_MODEL, and those partials read
# both without re-declaring a fallback literal.
# SOURCE | software/scripts/advanced/llm/ollama.profile.bash
# BEGIN/END | ollama default model

# --- Aliases: Claude ---
# SOURCE | software/scripts/advanced/llm/claude/claude.profile.bash

# --- Aliases: OpenCode ---
# SOURCE | software/scripts/advanced/llm/opencode/opencode.profile.bash

# --- Aliases: Pi ---
# SOURCE | software/scripts/advanced/llm/pi/pi.profile.bash

# --- Aliases: Copilot ---
# SOURCE | software/scripts/advanced/llm/copilot/copilot.profile.bash

# --- Aliases: Gemini ---
# SOURCE | software/scripts/advanced/llm/gemini/gemini.profile.bash

# --- Aliases: SSH ---
alias s="ssh"

################################################################################
# --- Utility Functions ---
################################################################################
# Keep matching input lines truncated at their last literal target.
function _truncate_at() {
  local mode="$1"
  local target="$2"
  if [[ -z "$target" ]]; then
    command cat
    return 0
  fi

  TRUNCATE_MODE="$mode" TRUNCATE_TARGET="$target" command awk '
    BEGIN {
      mode = ENVIRON["TRUNCATE_MODE"]
      target = ENVIRON["TRUNCATE_TARGET"]
      target_length = length(target)
    }
    {
      last_match = 0
      offset = 1
      while (offset <= length($0)) {
        match_position = index(substr($0, offset), target)
        if (match_position == 0) break
        last_match = offset + match_position - 1
        offset = last_match + 1
      }

      if (last_match == 0) {
        next
      } else if (mode == "after") {
        print substr($0, 1, last_match + target_length - 1)
      } else {
        print substr($0, last_match)
      }
    }
  '
}

# truncate_after <target>
# Keeps each input line from its start through the last literal target occurrence.
# Empty targets pass through unchanged; lines without the target are omitted.
function truncate_after() {
  if is_help_arg "${1:-}"; then
    echo "truncate_after: keep each matching input line through its last literal target
  Usage: command | truncate_after <target>
  Keeps the target itself. Empty targets pass through; unmatched lines are omitted.
  Example:
    echo 'alpha/target/omega' | truncate_after '/target'  # alpha/target"
    return 0
  fi
  _truncate_at "after" "${1:-}"
}
alias truncate=truncate_after

# truncate_before <target>
# Keeps each input line from its last literal target occurrence through its end.
# Empty targets pass through unchanged; lines without the target are omitted.
function truncate_before() {
  if is_help_arg "${1:-}"; then
    echo "truncate_before: keep each matching input line from its last literal target
  Usage: command | truncate_before <target>
  Keeps the target itself. Empty targets pass through; unmatched lines are omitted.
  Example:
    echo 'alpha/target/omega' | truncate_before '/target'  # /target/omega"
    return 0
  fi
  _truncate_at "before" "${1:-}"
}

# trim
# Removes leading and trailing spaces or tabs from every input line.
function trim() {
  if is_help_arg "${1:-}"; then
    echo "trim: remove leading and trailing spaces or tabs from each input line
  Usage: command | trim
  Preserves whitespace inside each line.
  Example:
    echo '  hello world  ' | trim  # hello world"
    return 0
  fi
  command sed 's/^[[:blank:]]*//; s/[[:blank:]]*$//'
}

# Return success when a value is a positive 1-based column number.
function _is_valid_column_number() {
  case "${1:-}" in
  "" | *[!0-9]*) return 1 ;;
  *[1-9]*) return 0 ;;
  *) return 1 ;;
  esac
}

# get_column [column]
# Prints one 1-based, whitespace-delimited column from every input line.
function get_column() {
  if is_help_arg "${1:-}"; then
    echo "get_column: print a whitespace-delimited column from each input line
  Usage: command | get_column [column]
  Column defaults to 1 and must be a positive integer.
  Consecutive spaces or tabs count as one delimiter.
  Example:
    echo 'alpha beta gamma' | get_column 2  # beta"
    return 0
  fi

  local column="${1:-1}"
  if ! _is_valid_column_number "$column"; then
    echo "get_column: column must be a positive integer" >&2
    return 2
  fi

  COLUMN_NUMBER="$column" command awk '
    BEGIN { column = ENVIRON["COLUMN_NUMBER"] }
    { print $column }
  '
}

# get_columns <column> [column...]
# Prints selected 1-based, whitespace-delimited columns from every input line.
function get_columns() {
  if is_help_arg "${1:-}"; then
    echo "get_columns: print selected whitespace-delimited columns from each input line
  Usage: command | get_columns <column> [column...]
  Each column must be a positive integer. Output columns are separated by one space.
  No columns passes input through unchanged.
  Example:
    echo 'alpha beta gamma delta' | get_columns 1 2 4  # alpha beta delta"
    return 0
  fi
  if [[ $# -eq 0 ]]; then
    command cat
    return 0
  fi

  local column
  local columns=""
  for column in "$@"; do
    if ! _is_valid_column_number "$column"; then
      echo "get_columns: every column must be a positive integer" >&2
      return 2
    fi
    if [[ -n "$columns" ]]; then
      columns="$columns,$column"
    else
      columns="$column"
    fi
  done

  COLUMN_NUMBERS="$columns" command awk '
    BEGIN { column_count = split(ENVIRON["COLUMN_NUMBERS"], columns, ",") }
    {
      output = ""
      for (selection_index = 1; selection_index <= column_count; selection_index++) {
        if (selection_index > 1) output = output OFS
        output = output $(columns[selection_index])
      }
      print output
    }
  '
}

# get_column_by <delimiter> [column]
# Prints one 1-based column separated by a literal custom delimiter.
function get_column_by() {
  if is_help_arg "${1:-}"; then
    echo "get_column_by: print a custom-delimited column from each input line
  Usage: command | get_column_by <delimiter> [column]
  Delimiter is literal text; column defaults to 1 and must be a positive integer.
  An empty delimiter passes input through unchanged.
  Example:
    echo 'alpha::beta::gamma' | get_column_by '::' 2  # beta"
    return 0
  fi

  local delimiter="${1:-}"
  local column="${2:-1}"
  if [[ -z "$delimiter" ]]; then
    command cat
    return 0
  fi
  if ! _is_valid_column_number "$column"; then
    echo "get_column_by: column must be a positive integer" >&2
    return 2
  fi

  COLUMN_DELIMITER="$delimiter" COLUMN_NUMBER="$column" command awk '
    BEGIN {
      delimiter = ENVIRON["COLUMN_DELIMITER"]
      column = ENVIRON["COLUMN_NUMBER"] + 0
      delimiter_length = length(delimiter)
    }
    {
      field_start = 1
      for (field = 1; field < column; field++) {
        delimiter_position = index(substr($0, field_start), delimiter)
        if (delimiter_position == 0) {
          print ""
          next
        }
        field_start += delimiter_position + delimiter_length - 1
      }

      remaining = substr($0, field_start)
      delimiter_position = index(remaining, delimiter)
      if (delimiter_position == 0) {
        print remaining
      } else {
        print substr(remaining, 1, delimiter_position - 1)
      }
    }
  '
}

function pwd2() {
  if is_help_arg "${1:-}"; then
    echo "pwd2: show current directory action summary
  Usage: pwd2"
    return 0
  fi
  print_action_summary "."
}

# to_windows_path / print_action_summary live in profile-core.sh so they are
# guaranteed available before any partial sourced via SOURCE markers tries to call
# them (view_file in bash-fzf, run_editor in editor-launchers).

################################################################################
# --- Diff (file diff or git hash compare) ---
################################################################################
# The core profile may install a `diff` alias. Remove it before defining this function,
# so repeated profile loads leave the smart dispatcher callable.
unalias diff 2> /dev/null || true

# smart diff for files or git commits
function diff() {
  local mode=delta1 mode_selected=false
  case "${1:-}" in
  -delta1)
    mode_selected=true
    shift
    ;;
  -delta2)
    mode=delta2
    mode_selected=true
    shift
    ;;
  -code)
    mode=code
    mode_selected=true
    shift
    ;;
  -zed | -z)
    mode=zed
    mode_selected=true
    shift
    ;;
  -winmerge)
    mode=winmerge
    mode_selected=true
    shift
    ;;
  -smerge | -sublime_merge)
    mode=smerge
    mode_selected=true
    shift
    ;;
  esac

  if is_help_arg "${1:-}"; then
    echo "
      diff: smart diff for files or git commits
        diff file1 file2                 Delta one-column diff (file1 left, file2 right)
        diff -delta2 file1 file2         Delta two-column diff
        diff -code file1 file2           open in VS Code
        diff -zed|-z file1 file2         open in Zed
        diff -winmerge file1 file2       open in WinMerge
        diff -smerge|-sublime_merge file1 file2  open in Sublime Merge
        diff abc123 def456               compare two Git commits
        diff [Delta mode] [Git args]     show tracked changes or Git diff options
        diff <diff flags> <files>        forward explicit flags to native diff
        diff help                        show this help
    "
    return 0
  fi

  local file1 file2 option_ended=false
  if [ "${1:-}" = "--" ]; then
    option_ended=true
    shift
  fi
  if [ "$mode" != delta1 ] && [ "$mode" != delta2 ]; then
    if [ "$#" -ne 2 ]; then
      echo "diff: editor mode requires exactly two files" >&2
      return 2
    fi
    file1=$1
    file2=$2
    if [ ! -f "$file1" ]; then
      echo "File not found: $file1" >&2
      return 1
    fi
    if [ ! -f "$file2" ]; then
      echo "File not found: $file2" >&2
      return 1
    fi

    local editor_binary editor_args=()
    case "$mode" in
    code)
      editor_binary=code
      editor_args=(--diff)
      ;;
    zed)
      editor_binary=zed
      editor_args=(--diff)
      ;;
    winmerge) editor_binary=winmergeu.exe ;;
    smerge)
      editor_args=(mergetool)
      if is_runnable_command smerge; then
        editor_binary=smerge
      else
        editor_binary=smerge.exe
      fi
      ;;
    esac
    if ! is_runnable_command "$editor_binary"; then
      echo "diff: required command not found: $editor_binary" >&2
      return 127
    fi
    "$editor_binary" "${editor_args[@]}" "$file1" "$file2"
    return $?
  fi

  # Unselected native flags retain diff behavior; selected Delta modes accept Git flags.
  if [ "$mode_selected" = false ] && [ "$option_ended" = false ]; then
    case "${1:-}" in
    -*)
      command diff "$@"
      return $?
      ;;
    esac
  elif [ "$mode_selected" = true ] && [ "$#" -gt 0 ]; then
    case "$1" in
    -*)
      if [ "$mode" = delta2 ]; then
        git -c delta.side-by-side=true diff "$@"
      else
        git -c delta.side-by-side=false diff "$@"
      fi
      return $?
      ;;
    esac
  fi

  if [ "$#" -eq 2 ] && [ -f "$1" ] && [ -f "$2" ]; then
    if [ "$mode" = delta2 ]; then
      git -c delta.side-by-side=true diff --no-index -- "$1" "$2"
    else
      git -c delta.side-by-side=false diff --no-index -- "$1" "$2"
    fi
    return $?
  fi

  if [ "$#" -eq 2 ]; then
    local file1_valid=false file2_valid=false
    local hash_re='^[a-f0-9]{4,40}$'
    local hash1_valid=false hash2_valid=false
    [ -f "$1" ] && file1_valid=true
    [ -f "$2" ] && file2_valid=true
    if [[ "$1" =~ $hash_re ]] && git rev-parse --verify "$1" &> /dev/null; then hash1_valid=true; fi
    if [[ "$2" =~ $hash_re ]] && git rev-parse --verify "$2" &> /dev/null; then hash2_valid=true; fi

    if $file1_valid && ! $file2_valid; then
      echo "File not found: $2" >&2
      return 1
    fi
    if ! $file1_valid && $file2_valid; then
      echo "File not found: $1" >&2
      return 1
    fi
    if $hash1_valid && $hash2_valid; then
      echo "git diff $1 $2"
      git diff "$1" "$2"
      local diff_status=$?

      local repo_url
      repo_url=$(git config --get remote.origin.url 2> /dev/null)
      if [ -n "$repo_url" ] && is_runnable_command open; then
        repo_url="${repo_url#*:}"
        repo_url="${repo_url%.git}"
        repo_url="${repo_url#*github.com/}"
        local compare_url="https://github.com/${repo_url}/compare/${1}...${2}"
        echo "$compare_url"
        open "$compare_url"
      fi
      return "$diff_status"
    fi
    if ! $hash1_valid && ! $file1_valid; then echo "File or hash not found: $1" >&2; fi
    if ! $hash2_valid && ! $file2_valid; then echo "File or hash not found: $2" >&2; fi
    return 1
  fi

  if [ "$#" -gt 2 ]; then
    command diff "$@"
    return $?
  fi

  if [ "$#" -eq 1 ]; then
    if [ ! -f "$1" ]; then
      echo "File not found: $1" >&2
      return 1
    fi
    if git rev-parse --is-inside-work-tree &> /dev/null; then
      if git ls-files --error-unmatch -- "$1" &> /dev/null; then
        if [ "$mode" = delta2 ]; then
          git -c delta.side-by-side=true diff -- "$1"
        else
          git -c delta.side-by-side=false diff -- "$1"
        fi
        return $?
      fi
      if [ "$mode" = delta2 ]; then
        git -c delta.side-by-side=true diff --no-index -- /dev/null "$1"
      else
        git -c delta.side-by-side=false diff --no-index -- /dev/null "$1"
      fi
      return $?
    fi
    command diff "$1"
    return $?
  fi

  if [ "$mode" = delta2 ]; then
    git -c delta.side-by-side=true diff "$@"
  else
    git -c delta.side-by-side=false diff "$@"
  fi
  return $?
}

# pdiff: compare clipboard contents with a file
# Args: leading diff options, then one file. Returns diff/capture status; invalid input is nonzero.
# Writes a private snapshot via mktemp; successful captures remain for asynchronous GUI readers.
function pdiff() {
  local diff_args=() option_ended=0
  while [ "$#" -gt 0 ]; do
    if ((! option_ended)) && is_help_arg "$1"; then
      echo "pdiff: compare clipboard contents with a file
  Usage: pdiff [diff options] file
  Clipboard is left; file is right. Leading options/selectors match diff.
  Examples: pdiff file; pdiff -delta2 file; pdiff -code file; pdiff -u file
  Use -- before a leading-dash filename.
  Snapshots remain in \${TMPDIR:-/tmp}/pdiff.* for GUI readers; remove when done."
      return 0
    fi
    [ "$#" -eq 1 ] && break
    [ "$1" = "--" ] && option_ended=1
    diff_args+=("$1")
    shift
  done

  if [ "$#" -ne 1 ]; then
    echo "pdiff: requires a file; usage: pdiff [diff options] file" >&2
    return 2
  fi
  if [ ! -f "$1" ]; then
    echo "File not found: $1" >&2
    return 1
  fi

  local clipboard_file capture_status
  clipboard_file=$(mktemp "${TMPDIR:-/tmp}/pdiff.XXXXXX") || return $?
  if paste > "$clipboard_file"; then
    diff "${diff_args[@]}" "$clipboard_file" "$1"
    return $?
  else
    capture_status=$?
    command rm -f -- "$clipboard_file"
    return "$capture_status"
  fi
}

alias diff_delta1='diff -delta1'
alias pdiff_delta1='pdiff -delta1'
alias diff_delta2='diff -delta2'
alias pdiff_delta2='pdiff -delta2'
alias diff_code='diff -code'
alias pdiff_code='pdiff -code'
alias diff_zed='diff -zed'
alias pdiff_zed='pdiff -zed'
alias diff_z='diff -zed'
alias pdiff_z='pdiff -zed'
alias diff_winmerge='diff -winmerge'
alias pdiff_winmerge='pdiff -winmerge'
alias diff_smerge='diff -smerge'
alias pdiff_smerge='pdiff -smerge'
alias diff_sublime_merge='diff -smerge'
alias pdiff_sublime_merge='pdiff -smerge'

# SOURCE | software/scripts/bash-git-helpers.profile.bash

################################################################################
# --- Search Functions ---
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
  if is_help_arg "${1:-}"; then
    echo "search: search content in files (rg > git grep > grep)
  Usage: search <pattern>"
    return 0
  fi
  if type -P rg &> /dev/null; then
    rg -Fwin "$@" # ripgrep: fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  elif git rev-parse --is-inside-work-tree &> /dev/null; then
    git grep -Fwin "$@" # fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  else
    grep --color -rFwin "$@" . # recursive, fixed string, whole word, case-insensitive, line numbers
  fi
}

################################################################################
# --- Rainbow / Visual ---
################################################################################
_RAINBOW_BLOCK="##########"
_RAINBOW_COLORS=(91 93 92 96 94 95)

function rainbow_print() {
  if is_help_arg "${1:-}"; then
    echo "rainbow_print: print text in rainbow colors
  Usage: rainbow_print [colors] <text>"
    return 0
  fi
  local colors
  if [[ -n "$1" && "$1" =~ ^[0-9[:space:]]+$ ]]; then
    colors=($1)
    shift
  else
    colors=("${_RAINBOW_COLORS[@]}")
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

# br [clear|no-clear] [normal|reverse] [count]
function br() {
  if is_help_arg "${1:-}"; then
    echo "br: print rainbow separator lines
  Usage: br [clear|no-clear] [normal|reverse] [count]
  Screen is cleared unless 'no-clear' is passed; colors normal unless 'reverse'; count defaults to 5.
  See also: hr (= br no-clear)"
    return 0
  fi
  local clear_flag=${1:-"clear"}
  local reverse_flag=${2:-"normal"}
  local repeat_count=${3:-5}

  [[ "$clear_flag" != "no-clear" ]] && printf "\033[H\033[2J"

  local colors=("${_RAINBOW_COLORS[@]}")

  if [[ "$reverse_flag" == "reverse" ]]; then
    local reversed=()
    for ((i = ${#colors[@]} - 1; i >= 0; i--)); do
      reversed+=("${colors[i]}")
    done
    colors=("${reversed[@]}")
  fi

  local line=""
  for ((i = 0; i < repeat_count; i++)); do
    line+="$_RAINBOW_BLOCK"
  done

  echo "$line" | rainbow_print "${colors[*]}"
}

# hr - rainbow separator without clearing the screen (br no-clear).
# A function, not an alias, so other profile functions can call it regardless
# of definition order.
#   hr                same as: br no-clear
#   hr reverse 10     same as: br no-clear reverse 10
function hr() {
  br no-clear "$@"
}

# spinner &; SPIN_PID=$!; sleep 3; kill $SPIN_PID
function spinner() {
  if is_help_arg "${1:-}"; then
    echo "spinner: show an animated spinner (run in background)
  Usage: spinner &; SPIN_PID=\$!; sleep 3; kill \$SPIN_PID"
    return 0
  fi
  local chars="/-\|"
  local colors=(91 93 92 96 94 95)
  local c_idx=0

  tput civis
  trap "tput cnorm; exit" SIGINT INT TERM EXIT

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
# --- Chmod ---
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
# --- Date / Time ---
################################################################################
# Returns HH:MM:SS AM/PM with colored AM/PM indicator for PS1
function get_time() {
  local tz=${1:-""}
  local datetime ampm

  if [ "$tz" = "UTC" ]; then
    datetime=$(command date -u +'%I:%M:%S %p')
  elif [ -n "$tz" ]; then
    datetime=$(TZ="$tz" command date +'%I:%M:%S %p')
  else
    datetime=$(command date +'%I:%M:%S %p')
  fi

  ampm="${datetime##* }"
  if [ "$ampm" = "AM" ]; then
    printf '%s\001\e[1;97m\002%s\001\e[m\002' "${datetime% *}" "$ampm"
  else
    printf '%s\001\e[0;90m\002%s\001\e[m\002' "${datetime% *}" "$ampm"
  fi
}

# Emits the local + UTC time pair for PS1 in a single subshell.
# PS1 previously used two `$(get_time ...)` substitutions, forking twice per
# prompt render; this collapses that to one. Colors are inlined with \001/\002
# (the command-substitution equivalent of PS1's \[ \]) so the prompt width is
# still computed correctly by readline.
function get_time_prompt() {
  printf '\001\e[1;92m\002'
  get_time
  printf ' \001\e[1;93m\002U='
  get_time "UTC"
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

# SOURCE | software/scripts/bash-env-telemetry.profile.bash
################################################################################
# --- Environment ---
################################################################################
# anthropic - claude code
export CLAUDE_CODE_DISABLE_TERMINAL_TITLE="1" # prevent Claude Code from overwriting the terminal tab title
# astral - uv
export UV_VENV_CLEAR="1" # skip "replace existing venv?" prompt in uv venv
# github - electron
export ELECTRON_ENABLE_LOGGING="0" # suppress Electron's internal console spam for slight perf gain
# terminal
# Only set TERM when unset, dumb, or bare xterm — avoids clobbering
# tmux (screen-256color/tmux-256color), Ghostty (xterm-ghostty), kitty, etc.
case "${TERM:-}" in
"" | dumb | xterm) export TERM="xterm-256color" ;;
esac
export COLORTERM="truecolor" # advertise 24-bit RGB color support to CLI apps

# SOURCE | software/scripts/bash-prompt-legacy.profile.bash

################################################################################
# --- Aliases: Docker ---
################################################################################
alias d='docker'
alias drun='docker run'
alias dexec='dexec_bash'
alias apt='sudo apt'
# Note: this is in the Docker section for historical reasons.
# To move to OS-specific Ubuntu tweaks, check the bottom of this file.

################################################################################
# --- Docker ---
################################################################################
function dexec_bash() {
  if is_help_arg "${1:-}"; then
    echo "dexec_bash: docker exec -it into container with bash
  Usage: dexec_bash <container>"
    return 0
  fi
  echo "docker exec -it $@ /bin/bash"
  docker exec -it $@ /bin/bash
}

################################################################################
# --- Open (cross-platform) ---
################################################################################
# open: render local Markdown to HTML, then open the target in the system app.
function open() {
  if is_help_arg "${1:-}"; then
    echo "open: open a file or folder in the default system app (local .md files render to HTML)
  Usage: open [file|folder|URL]"
    return 0
  fi
  local target="${1:-.}"
  if [ -f "$target" ] && [[ "$target" == *.md ]]; then
    target="$(marked "$target")" || return $?
  fi
  print_action_summary "$target" open

  if ((is_os_mac)); then
    command open "$target"
  elif type -P explorer.exe &> /dev/null; then
    explorer.exe "$target"
  elif type -P dolphin &> /dev/null; then
    dolphin "$target" 1>&- 2>&- &
  elif type -P thunar &> /dev/null; then
    thunar "$target" 1>&- 2>&- &
  elif type -P termux-open &> /dev/null; then
    # Android: hands the path to the system intent chooser. Checked before
    # xdg-open because Termux:X11 can leave a stale xdg-open on PATH.
    termux-open "$target"
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

# SOURCE | software/scripts/bash-window-manager.profile.bash

################################################################################
# --- Unwrap (paragraph-block line-rejoin) ---
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
# breaks. ``` fenced blocks are always preserved verbatim, and input that
# looks like a unified diff is passed through untouched (see isPatch).
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
  # bash 3.2 keeps tracking quotes inside a heredoc body when that heredoc is
  # nested in `$( ... )`, so an odd apostrophe count in the JS below silently
  # breaks the parse of the whole profile. Reading into a variable keeps the
  # heredoc at the top level, where every bash treats the body as literal text.
  local unwrap_js
  IFS= read -r -d '' unwrap_js << 'JS_EOF' || true
const text = require('fs').readFileSync(0, 'utf8');
const FENCE = '\x60\x60\x60';
const HEAD_TOLERANCE = 5;   // head-line widths must agree within this many chars
const MIN_HEAD_WIDTH = 50;  // ignore short blocks (bullet lists, labels)
const LAST_GAP = 10;        // last line must be this much shorter than the head

const lines = text.split('\n');

// A unified diff is whitespace-significant: a blank context line is a single
// space, and every body line's leading '+', '-' or ' ' is load-bearing.
// Trimming a context line or joining wrapped-looking body lines makes
// 'git apply' report "corrupt patch". Detect and pass through untouched.
// Matched on 'diff --git' and real hunk headers only — both unambiguous.
// A bare '--- ' is not enough (Markdown front matter and rules look the same).
const HUNK_RE = /^@@ -[0-9]+(,[0-9]+)? \+[0-9]+(,[0-9]+)? @@/;
const isPatch = lines.some(
  (l) => l.slice(0, 11) === 'diff --git ' || HUNK_RE.test(l)
);

if (isPatch) {
  process.stdout.write(text);
} else {
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
    // Push the original line, not '' — a whitespace-only line may carry
    // meaning (diff context, Markdown hard break) and is not ours to discard.
    if (trimmed === '') { flushBlock(); out.push(line); continue; }
    block.push(line);
  }
  flushBlock();
  let result = out.join('\n');
  if (text.endsWith('\n') && !result.endsWith('\n')) result += '\n';
  process.stdout.write(result);
}
JS_EOF
  node -e "$unwrap_js"
}
alias u=unwrap

# SOURCE | software/scripts/bash-clipboard.profile.bash

################################################################################
# --- TLDR (shell function aware) ---
# wraps tldr to show inline --help for shell functions before falling back to real tldr
################################################################################
function tldr() {
  if [ "$(type -t "$1" 2> /dev/null)" = "function" ]; then
    # Only dispatch to the function if it has an is_help_arg guard — otherwise
    # calling "$1" --help may execute it (spinner → infinite loop, open → file manager).
    if declare -f "$1" | grep -q is_help_arg; then
      "$1" --help
    else
      echo "tldr: '$1' is a shell function (use 'type $1' or 'declare -f $1' for details)"
      type "$1"
    fi
  else
    command tldr "$@"
  fi
}

# SOURCE | software/scripts/bash-net-utils.profile.bash
################################################################################
# --- Retry ---
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
# --- Benchmark ---
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

  # ns available only when both start_time and end_time are all-digit (>10 chars)
  if [ ${#start_time} -gt 10 ] && [ "${start_time//[0-9]/}" = "" ] && [ "${end_time//[0-9]/}" = "" ]; then
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

# SOURCE | software/scripts/bash-shared-folder.profile.bash
# SOURCE | software/scripts/bash-file-dropbox-sync-utils.profile.bash
# SOURCE | software/scripts/github-runner.profile.bash

################################################################################
# --- Screenshots (Shared Network Folder) ---
# Backs up local screenshots to the shared network folder, skipping duplicates
# by MD5 hash. Only copies image files (png, jpg, jpeg, gif, bmp, webp, tiff).
################################################################################
# find the local screenshots source folder
function _screenshot_local_folder() {
  [ -n "${BASHRC_SCREENSHOT_DIR:-}" ] && [ -d "$BASHRC_SCREENSHOT_DIR" ] && echo "$BASHRC_SCREENSHOT_DIR" && return 0
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
  if is_help_arg "${1:-}"; then
    echo "screenshot_open_local: open local screenshots folder
  Usage: screenshot_open_local"
    return 0
  fi
  local src_folder
  src_folder=$(_screenshot_local_folder) || {
    echo "No local screenshots folder found"
    return 1
  }
  open "$src_folder" &> /dev/null || echo "$src_folder"
}

# screenshot_open_shared: open the shared network screenshots folder
function screenshot_open_shared() {
  if is_help_arg "${1:-}"; then
    echo "screenshot_open_shared: open shared network screenshots folder
  Usage: screenshot_open_shared"
    return 0
  fi
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
# --- Sync ---
# Runs common housekeeping tasks: screenshot backup and patch cleanup.
################################################################################
# housekeeping: run backup, screenshot backup, and patch cleanup
function housekeeping() {
  if is_help_arg "${1:-}"; then
    echo "housekeeping: run backup, screenshot backup, and patch cleanup
  Usage: housekeeping"
    return 0
  fi

  local ts
  ts=$(date +%Y_%m_%d_%H_%M)

  local _logdir="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}"
  command mkdir -p "$_logdir" 2> /dev/null || true

  local hk_start=$SECONDS
  echo "housekeeping started at $(date)"

  (
    local log="$_logdir/log_${ts}_patch_cleanup.txt"
    local start=$SECONDS
    echo "  > patch_cleanup started at $(date)" | tee -a "$log"
    patch_cleanup &> "$log"
    echo "  > patch_cleanup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
  ) &
  (
    local log="$_logdir/log_${ts}_screenshot_backup.txt"
    local start=$SECONDS
    echo "  > screenshot_backup started at $(date)" | tee -a "$log"
    screenshot_backup &> "$log"
    echo "  > screenshot_backup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
  ) &
  if type backup &> /dev/null; then
    (
      local log="$_logdir/log_${ts}_backup.txt"
      local start=$SECONDS
      echo "  > backup started at $(date)" | tee -a "$log"
      backup &> "$log"
      echo "  > backup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
    ) &
  fi

  wait
  echo "housekeeping done at $(date) ($((SECONDS - hk_start))s). Logs: $_logdir/log_${ts}_*.txt"
}

################################################################################
# --- Bookmarks ---
################################################################################
if type add_bookmark &> /dev/null; then
  # one variadic call, not three - each call costs a fork
  add_bookmark fuzzy_edit fuzzy_recent_files commit_empty_trigger_deploy
fi

################################################################################
# --- refresh / upgrade ---
################################################################################
# refresh: re-run profile setup only (skip OS dependency installation)
alias refresh="SKIP_SETUP=1 curl -fsSL $BASH_PROFILE_CODE_REPO_RAW_URL/software/bootstrap/setup.sh | bash"
# upgrade: update OS packages + full setup with OS dependency installation
alias upgrade="update && curl -fsSL $BASH_PROFILE_CODE_REPO_RAW_URL/software/bootstrap/setup.sh | bash"

################################################################################
# --- Update Notifier ---
# Checks if local bashrc clone is behind origin/master (at most once per day).
# Background fetch writes to a temp file; the next prompt displays it via
# _bashrc_update_check_show (avoids echoing from a background process, which
# collides with starship prompt rendering and causes blank-line hangs).
################################################################################
function _bashrc_update_check() {
  local repo_dir="" _candidate
  # Check env var first, then fall back to candidate list
  if [ -n "${BASHRC_REPO_DIR:-}" ] && [ -d "$BASHRC_REPO_DIR/.git" ]; then
    repo_dir="$BASHRC_REPO_DIR"
  else
    for _candidate in "$HOME/Downloads/bashrc" "$HOME/bashrc" "$HOME/.bashrc-repo"; do
      if [ -d "$_candidate/.git" ]; then
        repo_dir="$_candidate"
        break
      fi
    done
  fi
  [ -z "$repo_dir" ] && return

  # throttle: at most once per day, via the shared last-run cache
  # (cache_lastrun_* in profile-core.sh) ->
  # /tmp/cache-lastrun-bashrc-update-check.timestamp
  cache_lastrun_due bashrc-update-check 86400 || return
  cache_lastrun_mark bashrc-update-check

  local _tmpdir="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}"
  command mkdir -p "$_tmpdir" 2> /dev/null || true
  local msg_file="$_tmpdir/.bashrc_update_check_msg"

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
  local msg_file="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}/.bashrc_update_check_msg"
  if [ -f "$msg_file" ]; then
    command cat "$msg_file"
    rm -f "$msg_file"
  fi
}
_prompt_command_add "_bashrc_update_check_show"

################################################################################
# --- Deferred Profile Blocks (heavy or late-loading) ---
# --- Post-profile Integrations (registerWithBashSyleProfile) ---
################################################################################
# SOURCE | software/scripts/bash-history.profile.bash
# SOURCE | software/scripts/bash-keys.profile.bash
# SOURCE | software/scripts/bash-file-utils.profile.bash
# SOURCE | software/scripts/bash-snip.profile.bash
# SOURCE | software/scripts/bash-sqlite.profile.bash
# SOURCE | software/scripts/bash-tmux-workspace.profile.bash
# BEGIN/END | Fuzzy Filter Patterns
# SOURCE | software/scripts/bash-fzf.profile.bash
# SOURCE | software/scripts/advanced/editor-launchers-common.profile.bash
# BEGIN/END | Editor Launchers - Vim
# BEGIN/END | Editor Launchers - Sublime Text
# BEGIN/END | Editor Launchers - Sublime Merge
# BEGIN/END | Editor Launchers - VS Code
# BEGIN/END | Editor Launchers - Zed
# BEGIN/END | Text Server
# BEGIN/END | Browser Launch Options
# SOURCE | software/scripts/advanced/browser-launchers-common.profile.bash
# BEGIN/END | Browser Launchers - Brave
# BEGIN/END | Browser Launchers - Chrome
# BEGIN/END | Browser Launchers - Edge
# BEGIN/END | Browser Launchers - Chromium
# BEGIN/END | Browser Launchers - Vivaldi
# BEGIN/END | Browser Launchers - Opera
# BEGIN/END | Browser Launchers - Arc
# BEGIN/END | starship prompt

################################################################################
# --- Spec-based Autocomplete (bash-autocomplete-complete-spec.js) ---
################################################################################
# BEGIN/END | Spec Autocomplete
# SOURCE | software/scripts/bash-base85.profile.bash
# SOURCE | software/scripts/bash-command-wrappers.profile.bash
# SOURCE | software/scripts/docker-shares.profile.bash
# SOURCE | software/scripts/bash-snip-command-wrappers.profile.bash

# Sourced LAST on purpose: every alias, fuzzy_* picker, and snip base command
# above must already exist before the dynamic-alias generators iterate them.
# Generates the ls_*_first / i-prefixed / snip command families once and caches
# them to ~/.bash_syle_cache; later shells source the cache instead of forking.
# SOURCE | software/scripts/bash-dynamic-aliases.profile.bash

################################################################################
# --- OS-specific Tweaks (registerPlatformTweaks) ---
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
