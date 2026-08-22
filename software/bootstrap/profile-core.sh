#!/usr/bin/env bash
# software/bootstrap/profile-core.sh

# --- Debug Tracing ---
# Enable:  echo 1 > $_BASHRC_DEBUG_DIR/debug
# Disable: rm $_BASHRC_DEBUG_DIR/debug
# Logs stacktrace to $_BASHRC_DEBUG_DIR/debug.log on ERR and EXIT.
_BASHRC_DEBUG_DIR="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}"
if [ -f "$_BASHRC_DEBUG_DIR/debug" ]; then
  _debug_val=$(command cat "$_BASHRC_DEBUG_DIR/debug" 2> /dev/null)
  case "$_debug_val" in
  1 | true | TRUE | True)
    set -x
    function _debug_stacktrace() {
      local exit_code=$?
      local log="$_BASHRC_DEBUG_DIR/debug.log"
      {
        echo "--- ${1:-ERROR} at $(date '+%Y-%m-%d %H:%M:%S') (exit code: $exit_code) ---"
        local i
        for ((i = 0; i < ${#FUNCNAME[@]}; i++)); do
          echo "  [$i] ${FUNCNAME[$i]}() at ${BASH_SOURCE[$i]:-profile}:${BASH_LINENO[$i]}"
        done
        echo ""
      } >> "$log"
      echo "[debug] $1: exit=$exit_code at ${BASH_SOURCE[1]:-profile}:${BASH_LINENO[0]} in ${FUNCNAME[1]:-main} (see $log)" >&2
    }
    trap '_debug_stacktrace ERR' ERR
    trap '_debug_stacktrace EXIT' EXIT
    ;;
  esac
  unset _debug_val
fi

# bashrc_debug <on|off|status> - Control debug tracing
function bashrc_debug() {
  if is_help_arg "${1:-}"; then
    echo "bashrc_debug: control debug tracing
  Usage: bashrc_debug on     enable debug tracing
         bashrc_debug off    disable debug tracing
         bashrc_debug status show current debug state"
    return 0
  fi
  local _debug_file="$_BASHRC_DEBUG_DIR/debug"
  case "${1:-}" in
  on)
    echo 1 > "$_debug_file"
    set -x
    echo ">> Debug tracing enabled"
    ;;
  off)
    rm -f "$_debug_file"
    set +x
    echo ">> Debug tracing disabled"
    ;;
  status)
    if [ -f "$_debug_file" ]; then
      echo ">> Debug tracing is ON"
    else
      echo ">> Debug tracing is OFF"
    fi
    ;;
  *)
    echo "bashrc_debug: unknown command '${1:-}' (expected: on, off, status)" >&2
    return 1
    ;;
  esac
}

# is_bash_ge <major> [minor] - Returns 0 if BASH_VERSINFO >= <major>[.<minor>]
function is_bash_ge() {
  local req_maj="$1" req_min="${2:-0}"
  [ "${BASH_VERSINFO[0]}" -gt "$req_maj" ] && return 0
  [ "${BASH_VERSINFO[0]}" -eq "$req_maj" ] && [ "${BASH_VERSINFO[1]}" -ge "$req_min" ] && return 0
  return 1
}

# _prompt_command_add <snippet> - Idempotently prepend to PROMPT_COMMAND with dedupe
function _prompt_command_add() {
  local snippet="$1"
  [[ "$PROMPT_COMMAND" == *"$snippet"* ]] && return 0
  PROMPT_COMMAND="${snippet}${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
}

# --- Pre-core Profile Blocks (registerWithBashSyleProfile) ---
# BEGIN/END | Profile Generated Timestamp
# BEGIN/END | fnm - fast node manager
# BEGIN/END | format script
# BEGIN/END | mac-system-setup
# BEGIN/END | temporal-cli
# SOURCE | PATH dedupe + prune | software/scripts/bash-path-candidate.profile.bash

export EDITOR='vim'
export VISUAL="$EDITOR"
export PAGER="less"
export GIT_EDITOR="$EDITOR"
export BASH_PATH=~/.bash_syle
export LINE_BREAK_COUNT=100
printf -v LINE_BREAK_HASH '%*s' "$LINE_BREAK_COUNT" ''
LINE_BREAK_HASH=${LINE_BREAK_HASH// /#}
export LINE_BREAK_HASH
printf -v LINE_BREAK_SLASH '%*s' "$LINE_BREAK_COUNT" ''
LINE_BREAK_SLASH=${LINE_BREAK_SLASH// /\//}
export LINE_BREAK_SLASH
printf -v LINE_BREAK_EQUAL '%*s' "$LINE_BREAK_COUNT" ''
LINE_BREAK_EQUAL=${LINE_BREAK_EQUAL// /=}
export LINE_BREAK_EQUAL

# --- Help-Trigger Helper ---
# Single source of truth for the "is this arg a --help request?" check used by
# every user-facing function across the profile. Defined in profile-core (not
# profile-advanced) so any partial sourced later can rely on it. Keep this
# function body byte-identical with the copy in common-functions.bash — the
# pair must accept the same trigger set.

# is_help_arg <arg> - returns 0 (success) if arg is a recognized --help trigger
# Recognizes (case-insensitive):
#   help, --help, -help, /help    full word, every common prefix style
#   -h                            short
#   ?, -?, /?                     DOS / PowerShell short
# `tr` (not bash 4's ${var,,}) is used so this stays parseable on bash 3.2 —
# safe_source rejects any partial that fails `bash -n` on macOS's /bin/bash.
# Single-quote `?` patterns in the case so glob expansion does not match them
# against any single character.
function is_help_arg() {
  local arg
  arg=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
  case "$arg" in
  help | --help | -help | /help | -h | '?' | '-?' | '/?') return 0 ;;
  *) return 1 ;;
  esac
}

# --- CPU Arch Helpers (Apple Silicon / Rosetta 2) ---

# get_native_arch - Prints the machine's real CPU architecture (arm64, x86_64, aarch64, ...).
# On Apple Silicon `uname -m` reports x86_64 whenever the calling process is translated
# by Rosetta 2, so hw.optional.arm64 is consulted first and wins. Everywhere else this
# is plain `uname -m`.
# Mirror of the same function in common-functions.bash — keep the body byte-identical.
function get_native_arch() {
  if [ "$(uname -s)" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2> /dev/null)" = "1" ]; then
    echo "arm64"
    return 0
  fi
  uname -m
}

# is_arch_translated - Returns 0 when the current process runs under Rosetta 2, i.e. an
# x86_64 process on Apple Silicon. Every child process inherits that translated arch, so
# Homebrew resolves x86_64 bottles/casks, npm resolves darwin-x64 optional dependencies,
# and GUI apps launch their Intel slice. Always 1 (false) off macOS.
# Mirror of the same function in common-functions.bash — keep the body byte-identical.
function is_arch_translated() {
  [ "$(uname -s)" = "Darwin" ] || return 1
  [ "$(sysctl -n sysctl.proc_translated 2> /dev/null)" = "1" ]
}

# run_native <cmd> [args...] - Runs a command on the machine's native CPU arch.
# Under Rosetta 2 the command is re-launched through `arch -<native arch>`; everywhere
# else it runs unchanged. Use it for installers and GUI launches so they do not inherit
# an Intel-translated environment on Apple Silicon. Only works with real binaries
# (`arch` execs its target), so pass `nohup`/`bash`/`npm`, never a shell function.
# Mirror of the same function in common-functions.bash — keep the body byte-identical.
function run_native() {
  if is_arch_translated && type -P arch > /dev/null 2>&1; then
    arch "-$(get_native_arch)" "$@"
    return $?
  fi
  "$@"
}

# --- Command Resolution Helpers ---

# is_runnable_command <name> - True when `"$name" args` is actually invokable from
# inside a function body (PATH binary, shell function, or builtin).
#
# Use this instead of `type -P` whenever the name may be a shell *function*.
# `type -P` only searches PATH, so it misses the GUI editor/browser wrappers that
# editor-launchers.js and browser-launchers.js define as bash functions (zed,
# code, subl, smerge, brave, ...). Plain binary detection should still use
# `type -P` per the repo convention.
#
# Aliases are deliberately rejected: bash performs no alias expansion on an
# expanded word (`"$cmd" "$file"`), so an alias-only name would pass the check
# and then die with "command not found".
function is_runnable_command() {
  if is_help_arg "${1:-}"; then
    echo "is_runnable_command: check whether a name can be invoked as \"\$name\" args
  Usage: is_runnable_command <name>
  True for PATH binaries, shell functions, and builtins. False for alias-only names."
    return 0
  fi
  local name="${1:-}"
  [ -n "$name" ] || return 1
  # `type -at` prints every resolution for the name, one per line, using the
  # fixed words alias/keyword/function/builtin/file. Split on whitespace with a
  # pinned IFS and match the words in pure bash — no external command — so the
  # check still works when PATH is broken or minimal (the exact situation where
  # an editor lookup is most likely to be asked).
  local _t
  local IFS=$' \t\n'
  for _t in $(type -at "$name" 2> /dev/null); do
    case "$_t" in
    file | function | builtin) return 0 ;;
    esac
  done
  return 1
}

# --- Command Variant Generation ---
#
# One engine for "define a decorated twin of every command in a family". A
# variant is the SAME command under a new name, with an env assignment and/or
# extra arguments bolted on — the shell spelling of the decorator pattern.
#
# Consumers today:
#   fzf pickers — `register_command_variants --prefix=i --select-fn='^fuzzy_'
#                  --select-alias='^fuzzy_' --env='FZF_CASE_MODE=insensitive'`
#                 gives ifuzzy_cd / ifcd / ifcat / iglog (see bash-fzf.profile.bash).
#
# A decorator can only ADD. It cannot express a variant that REMOVES a flag,
# which is why `ls_newest` / `ls_newest_last` (the second drops --reverse, and
# eza has no counter-flag) is NOT a candidate and stays hand-written.

# Registry of everything generated this session: `<variant>\t<expansion>` lines.
# Generated names appear in no source file, so `command_variants` is the only
# way to answer "where did ifcd come from?" — keep it populated.
_COMMAND_VARIANTS=""

# _alias_body: print the unquoted body of an alias, or nothing when it is not one
#
# `alias -p` prints `alias name='body'` with any embedded single quote written
# as the four characters '\''. The escape sequence is built in a variable
# rather than written inline: quoting it directly inside a substitution is
# unreadable, and that line has been mangled once already.
function _alias_body() {
  local name="${1:-}" line body
  [ -n "$name" ] || return 1
  line=$(alias "$name" 2> /dev/null) || return 1
  local _sq="'"
  local _esc_sq="${_sq}\\${_sq}${_sq}"
  body="${line#alias }"
  body="${body#*=}"
  body="${body#$_sq}"
  body="${body%$_sq}"
  body="${body//"$_esc_sq"/"$_sq"}"
  printf '%s' "$body"
}

# _expand_leading_alias: resolve an alias chain at the START of a command string
#
# A generated variant is a FUNCTION, and bash performs no alias expansion
# inside a function body — so `ls_newest` (an alias whose body starts with the
# alias `ll`) would produce a variant that dies with "command not found".
# Rewriting the leading word until it is a function, builtin, or binary is what
# makes an alias-of-an-alias usable as a variant target.
#
# Only the FIRST word is expanded, which is exactly what bash itself does, and
# the walk is capped so a self-referential alias cannot spin.
function _expand_leading_alias() {
  local cmd="${1:-}" head rest body hops=0
  while [ "$hops" -lt 10 ]; do
    head="${cmd%% *}"
    [ -n "$head" ] || break
    body=$(_alias_body "$head") || break
    [ -n "$body" ] || break
    if [ "$head" = "$cmd" ]; then
      rest=""
    else
      rest=" ${cmd#* }"
    fi
    # A self-referencing alias (alias ls='ls -F') is where bash stops, too:
    # the head was already substituted once by the caller, so leave it alone
    # rather than splicing the body in a second time.
    case "$body" in
    "$head" | "$head "*) break ;;
    esac
    cmd="${body}${rest}"
    hops=$((hops + 1))
  done
  printf '%s' "$cmd"
}

# _register_command_variant: define ONE variant. Internal to register_command_variants.
#
# Args: <base-name> <invocation> <prefix> <suffix> <env-assignments> <extra-args> <dry-run>
#   <base-name>   name the variant is derived FROM (function name or alias name)
#   <invocation>  what the variant actually runs (a function name, or an alias
#                 target such as `fuzzy_edit cat` — aliases cannot be called
#                 from a function body, so the TARGET is what gets embedded)
#
# Extra args are appended AFTER "$@" because argv is last-wins for most CLIs,
# so the decoration beats a flag the base command hardcoded.
function _register_command_variant() {
  local base="$1" invocation="$2" prefix="$3" suffix="$4" envs="$5" extra_args="$6" dry="$7"
  local new="${prefix}${base}${suffix}"

  # Never clobber an existing command — the i*/l* namespaces collide with real
  # binaries (id, ip, ls) and with anything the user defined first.
  is_runnable_command "$new" && return 0

  local body="${envs:+$envs }${invocation} \"\$@\"${extra_args:+ $extra_args}"
  if [ "$dry" = "1" ]; then
    echo "${new} -> ${body}"
    return 0
  fi

  eval "function ${new}() { ${body}; }" 2> /dev/null || return 1
  _COMMAND_VARIANTS="${_COMMAND_VARIANTS}${new}	${body}
"
}

# register_command_variants: generate decorated twins for a family of commands
#
# Selectors (at least one required) — plain regexes fed to `grep -E`:
#   --select-fn=RE          shell functions whose NAME matches
#   --select-alias=RE       aliases whose TARGET matches (e.g. '^fuzzy_')
#   --select-alias-name=RE  aliases whose NAME matches (e.g. '^ls_')
#
# Naming (at least one required):
#   --prefix=STR            ifuzzy_cd, ifcd
#   --suffix=STR            ls_newest_verbose
#
# Decoration (both optional, at least one is the point):
#   --env='K=V'             prepended assignment; repeatable. Temporary in bash
#                           for a function call, so nothing leaks into the shell.
#   --args='...'            appended after "$@"
#
#   --dry-run               print `<variant> -> <body>` instead of defining
#
# Idempotent: re-running skips names that already exist.
function register_command_variants() {
  if is_help_arg "${1:-}"; then
    echo "register_command_variants: generate decorated twins for a family of commands
  Usage: register_command_variants --prefix=i --select-fn='^fuzzy_' --env='FZF_CASE_MODE=insensitive'
         register_command_variants --suffix=_v --select-alias-name='^ls_' --args='--long'
  Selectors: --select-fn=RE --select-alias=RE (alias target) --select-alias-name=RE
  Naming:    --prefix=STR --suffix=STR (at least one)
  Decorate:  --env='K=V' (repeatable) --args='...'  |  --dry-run to preview
  See \`command_variants\` for what was generated."
    return 0
  fi

  local prefix="" suffix="" sel_fn="" sel_alias="" sel_alias_name=""
  local envs="" extra_args="" dry=0
  while [ $# -gt 0 ]; do
    case "$1" in
    --prefix=*) prefix="${1#*=}" ;;
    --suffix=*) suffix="${1#*=}" ;;
    --select-fn=*) sel_fn="${1#*=}" ;;
    --select-alias=*) sel_alias="${1#*=}" ;;
    --select-alias-name=*) sel_alias_name="${1#*=}" ;;
    --env=*) envs="${envs:+$envs }${1#*=}" ;;
    --args=*) extra_args="${1#*=}" ;;
    --dry-run) dry=1 ;;
    *)
      echo "register_command_variants: unknown option: $1" >&2
      return 1
      ;;
    esac
    shift
  done

  if [ -z "$prefix" ] && [ -z "$suffix" ]; then
    echo "register_command_variants: --prefix or --suffix is required" >&2
    return 1
  fi
  if [ -z "$sel_fn" ] && [ -z "$sel_alias" ] && [ -z "$sel_alias_name" ]; then
    echo "register_command_variants: a --select-* option is required" >&2
    return 1
  fi

  local name
  if [ -n "$sel_fn" ]; then
    for name in $(declare -F | command awk '{print $3}' | command grep -E "$sel_fn"); do
      _register_command_variant "$name" "$name" "$prefix" "$suffix" "$envs" "$extra_args" "$dry"
    done
  fi

  if [ -n "$sel_alias" ] || [ -n "$sel_alias_name" ]; then
    # `alias -p` prints `alias name='body'` with embedded quotes escaped as
    # '\''. Split on the FIRST '=' only (bodies contain them), strip the outer
    # single quotes, then unescape.
    local aliases line name target
    aliases=$(alias -p 2> /dev/null)
    while IFS= read -r line; do
      case "$line" in
      "alias "*) ;;
      *) continue ;;
      esac
      name="${line#alias }"
      name="${name%%=*}"
      target=$(_alias_body "$name")
      # An alias body that itself starts with an alias (ls_newest -> ll -> ls)
      # must be flattened: the variant is a function, and function bodies get
      # no alias expansion.
      target=$(_expand_leading_alias "$target")
      [ -n "$name" ] || continue
      [ -n "$target" ] || continue
      if [ -n "$sel_alias_name" ]; then
        printf "%s" "$name" | command grep -qE "$sel_alias_name" || continue
      fi
      if [ -n "$sel_alias" ]; then
        printf "%s" "$target" | command grep -qE "$sel_alias" || continue
      fi
      _register_command_variant "$name" "$target" "$prefix" "$suffix" "$envs" "$extra_args" "$dry"
    done <<< "$aliases"
  fi
}

# command_variants: list every variant generated by register_command_variants
#
# Generated names live in no source file, so this is the discovery surface —
# `command_variants | grep ifcd` answers "what does this run?".
function command_variants() {
  if is_help_arg "${1:-}"; then
    echo "command_variants: list generated command variants as '<name>\t<expansion>'
  Usage: command_variants [filter-regex]"
    return 0
  fi
  local filter="${1:-}"
  if [ -n "$filter" ]; then
    printf '%s' "$_COMMAND_VARIANTS" | command grep -E "$filter"
  else
    printf '%s' "$_COMMAND_VARIANTS"
  fi
}

# --- Path / Action Helpers ---

# to_windows_path <unix_path> - Convert a unix path to a Windows-style mixed-slash path
function to_windows_path() {
  if is_help_arg "${1:-}"; then
    echo "to_windows_path: convert unix path to Windows mixed-slash path
  Usage: to_windows_path <unix_path>
  No-op on non-WSL (echoes input unchanged)."
    return 0
  fi
  if type -P wslpath &> /dev/null; then
    wslpath -m "$1" 2> /dev/null || echo "$1"
  else
    echo "$1"
  fi
}

# print_action_summary <target_path> [<binary> [<extra_args>...]] - Render a copy-paste-
# print_action_summary [--run-folder=<folder>] <target_path> [<binary> [<extra_args>...]] -
# Render a copy-paste-runnable summary block for an "act on a path" operation.
function print_action_summary() {
  if is_help_arg "${1:-}"; then
    echo "print_action_summary: show copy-paste-runnable action summary
  Usage: print_action_summary [--run-folder=<folder>] <target_path> [<binary> [<extra_args>...]]
  Prints PWD, cd command, and optional binary invocation.
  --run-folder overrides the cd target for commands that must run somewhere
  other than where the file lives (e.g. applying a patch from inside the repo)."
    return 0
  fi

  # Optional cd override. Default (the folder holding the target) is right for
  # cd / view / edit / cat, where the file IS the thing being acted on. It is
  # wrong whenever the binary needs a different working folder than the file's:
  # a patch lives in a throwaway /tmp folder while `git_patch_apply` only works
  # inside the repo, so the default block cd'd out of the repo and every hunk
  # failed with "No such file or directory".
  local run_folder=""
  case "${1:-}" in
  --run-folder=*)
    run_folder="${1#--run-folder=}"
    shift
    ;;
  esac

  local target="$1"
  shift || return 1
  local binary="${1:-}"
  [ $# -gt 0 ] && shift
  local -a extra_args=("$@")

  # Resolve to absolute. Tolerate non-existent paths.
  local target_abs
  if type -P realpath &> /dev/null; then
    target_abs=$(realpath "$target" 2> /dev/null) || target_abs="$target"
  else
    local _dir
    _dir=$(dirname "$target" 2> /dev/null)
    _dir=$(cd -P "$_dir" 2> /dev/null && pwd -P)
    target_abs="${_dir:+$_dir/}$(basename "$target")"
    [ -z "$_dir" ] && target_abs="$target"
  fi

  # cd target = the override when given, else the folder. Parent for files, self
  # for directories. The override is resolved the same way as the target so the
  # block never mixes /tmp and /private/tmp spellings of the same folder; an
  # unresolvable override is printed as given rather than silently dropped.
  local dir
  if [ -n "$run_folder" ]; then
    if type -P realpath &> /dev/null; then
      dir=$(realpath "$run_folder" 2> /dev/null) || dir="$run_folder"
    else
      dir=$(cd -P "$run_folder" 2> /dev/null && pwd -P) || dir="$run_folder"
    fi
    [ -z "$dir" ] && dir="$run_folder"
  elif [ -d "$target_abs" ]; then
    dir="$target_abs"
  else
    dir=$(dirname "$target_abs")
  fi

  # WSL conversion.
  local resolved_dir resolved_target
  resolved_dir=$(to_windows_path "$dir")
  resolved_target=$(to_windows_path "$target_abs")

  echo "===================================="
  echo "PWD: \"$(pwd)\""
  echo "cd \"$dir\""
  [ "$resolved_dir" != "$dir" ] && echo "cd \"$resolved_dir\""
  if [ -n "$binary" ]; then
    local prefix="$binary"
    [ ${#extra_args[@]} -gt 0 ] && prefix="$binary ${extra_args[*]}"
    echo "$prefix \"$target_abs\""
    [ "$resolved_target" != "$target_abs" ] && echo "$prefix \"$resolved_target\""
  fi
  echo "===================================="
}

# --- Aliases: Coreutils Defaults ---
alias cp='cp -p'
alias ping='ping -c 5'
alias mkdir='mkdir -p' # silent on existing dirs (tradeoff: typo'd paths never surface)
alias df='df -h'
alias du='du -h'
alias free='free -h'

function less() {
  if is_help_arg "${1:-}"; then
    echo "less: open file in vim read-only mode (supports piping)
  Usage: less [file|-]
  Falls back to command less when vim is unavailable."
    return 0
  fi
  if ! type -P vim &> /dev/null; then
    command less "$@"
  else
    command vim -R "${@:--}"
  fi
}

function lsd() {
  if is_help_arg "${1:-}"; then
    echo "lsd: list directories only, sorted
  Usage: lsd [dir]"
    return 0
  fi
  find "${1:-.}" -mindepth 1 -maxdepth 1 -type d | sort
}

function lsda() {
  if is_help_arg "${1:-}"; then
    echo "lsda: list directories (absolute paths), sorted
  Usage: lsda [dir]"
    return 0
  fi
  find "${1:-$PWD}" -mindepth 1 -maxdepth 1 -type d -exec realpath {} \; | sort
}

function lsf() {
  if is_help_arg "${1:-}"; then
    echo "lsf: list files only, sorted
  Usage: lsf [dir]"
    return 0
  fi
  find "${1:-.}" -mindepth 1 -maxdepth 1 -type f | sort
}

function lsfa() {
  if is_help_arg "${1:-}"; then
    echo "lsfa: list files (absolute paths), sorted
  Usage: lsfa [dir]"
    return 0
  fi
  find "${1:-$PWD}" -mindepth 1 -maxdepth 1 -type f -exec realpath {} \; | sort
}

alias grep='command grep --color=auto'
if ls --version 2> /dev/null | command grep -q GNU; then
  # GNU ls uses --color=auto (requires =value)
  alias ls="ls -1 -F --color=auto"
else
  # BSD ls (macOS) — --color is a standalone flag (no =value)
  alias ls="ls -1 -F --color"
fi
alias ll="ls -lah"
if type -P colordiff &> /dev/null; then
  alias diff="colordiff"
elif diff --version 2> /dev/null | command grep -q GNU; then
  alias diff="command diff --color=auto"
fi
alias lc="wc -l"
alias tailf="tail -n 500 -f"
alias tailn="tail -n"
