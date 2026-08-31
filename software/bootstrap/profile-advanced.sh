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

# append history to file after every command (but do NOT clear+reload with -c/-r,
# so Up arrow navigates current tab's session history instead of showing commands
# from other tabs. Ctrl+R / fuzzy_history search the shared file for cross-tab history)
# Also force the terminal cursor back to a steady (non-blinking) block via
# DECSCUSR `\e[2 q` on every prompt — defends against shell integrations,
# plugins, or stray escape sequences that flip the cursor to a bar/beam.
_prompt_command_add "_rewrite_last_history_entry; _track_folder; history -a; echo -ne '\\033]0;'\"\$(shorter_pwd_path)\"'\\007\\033[2 q'"

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

# cd is provided by zoxide (init bash --cmd cd) — no wrapper needed.

# --- Aliases: File Listing (eza override) ---
if type -P eza &> /dev/null; then
  function ls() { command eza -1 -F --color=always "$@"; }
  # --time-style: eza's default drops the year ("5 Aug 09:30"), so a file from
  # last August is indistinguishable from one from this week. This renders
  # "2026/08/20 6:35PM" — full year first and zero-padded month/day so every
  # date is the same width and the column scans as a block; the hour keeps no
  # leading zero so it reads as a clock rather than a second padded number.
  # --no-permissions: the "drwxr-xr-x@" column is 11 characters of noise on
  # every row; reach for `ls -l` or `stat` on the rare occasion a mode matters.
  # eza cannot reorder columns (the name is always last in long view), so
  # trimming columns is the only lever on the layout.
  alias ll="ls -lah --no-permissions --time-style='+%Y/%m/%d %-I:%M%p'"
  # eza sorts ASCENDING by default, so a bare --sort=modified puts the newest
  # entry LAST and --sort=size puts the biggest LAST. eza's own --sort=newest
  # is the opposite of what it reads like (it lists oldest first) — don't use it.
  #
  # The BASE alias is the ascending one, which is also the useful default in a
  # terminal: the interesting row lands next to the prompt instead of scrolling
  # off the top. The `_first` twin is then the base plus --reverse, so it is
  # purely ADDITIVE and register_command_variants can generate it (see the
  # ls_*_first block right below). The old `_last` names are gone — `_last` is
  # now what the bare name does.
  alias ls_newest="ll --sort=modified" # newest last (oldest first)
  alias ls_biggest="ll --sort=size"    # biggest last (smallest first)

  # ls_newest_first / ls_biggest_first — the same listing, reversed. Generated
  # rather than written out so a new ls_* alias picks up its reversed twin for
  # free. --reverse is appended after "$@", and applying it twice does NOT
  # cancel, which is exactly why the base must stay unreversed.
  # `command_variants ls_` shows what came out. The generator call moved to
  # bash-dynamic-aliases.profile.bash (sourced last, cached) — the ls_* aliases
  # just need to exist by then, which they do.
fi

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
# git wrapper: invalidates branch cache on state-changing commands
function git() {
  command git "$@"
  local _git_exit=$?
  # Invalidate git branch cache on state-changing commands (write/subcommand groups only).
  # Collapsed from six identical branches into one pattern list.
  case "${1-}" in
  checkout | switch | pull | push | fetch | merge | rebase | commit | reset | \
    stash | cherry-pick | revert | am | apply | \
    c | cm | amend | amendm | wip | unwip | \
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
# SY_OMEN45L_OLLAMA_PORT / SY_OMEN45L_OLLAMA_DEFAULT_MODEL, and those partials read
# both without re-declaring a fallback literal.
# SOURCE | software/scripts/advanced/llm/ollama.profile.bash

# --- Aliases: Claude ---
# SOURCE | software/scripts/advanced/llm/claude/claude.profile.bash

# --- Aliases: OpenCode ---
# SOURCE | software/scripts/advanced/llm/opencode/opencode.profile.bash

# --- Aliases: Copilot ---
# SOURCE | software/scripts/advanced/llm/copilot/copilot.profile.bash

# --- Aliases: Gemini ---
# SOURCE | software/scripts/advanced/llm/gemini/gemini.profile.bash

# --- Aliases: SSH ---
alias s="ssh"

################################################################################
# --- Utility Functions ---
################################################################################
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

# br [count] [no-clear] [reverse]
function br() {
  if is_help_arg "${1:-}"; then
    echo "br: print rainbow separator lines
  Usage: br [count] [clear|no-clear] [normal|reverse]
  count defaults to 5, screen is cleared unless 'no-clear' is passed."
    return 0
  fi
  local repeat_count=${1:-5}
  local clear_flag=${2:-"clear"}
  local reverse_flag=${3:-"normal"}

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
function open() {
  if is_help_arg "${1:-}"; then
    echo "open: open a file or folder in the default system app
  Usage: open [file|dir]"
    return 0
  fi
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

  # throttle: at most once per day
  local _tmpdir="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}"
  command mkdir -p "$_tmpdir" 2> /dev/null || true
  local stamp_file="$_tmpdir/.bashrc_update_check_stamp"
  if [ -f "$stamp_file" ]; then
    local stamp_age
    stamp_age=$(($(date +%s) - $(stat -c '%Y' "$stamp_file" 2> /dev/null || stat -f '%m' "$stamp_file" 2> /dev/null || echo 0)))
    [ "$stamp_age" -lt 86400 ] && return
  fi
  touch "$stamp_file"

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
# --- Spec-based Autocomplete (bash-autocomplete-complete-spec.js) ---
################################################################################
# BEGIN/END | Spec Autocomplete
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
