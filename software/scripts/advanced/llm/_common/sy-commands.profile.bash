#!/usr/bin/env bash

################################################################################
# --- sy-* skill dispatchers (shared across all LLM CLIs) ---
#
# Bash wrappers around every `_common/commands/<name>.md` so the same workflow
# can be invoked from the terminal. Four families are auto-registered per skill:
#
#   sy-<name>                       interactive; CLI chosen at call time
#   sy-run-<name>                   print output; CLI chosen at call time
#   <cli>_skill_<name>              interactive; CLI baked into function name
#   <cli>_skill_run_<name>          print output; CLI baked into function name
#
# Plus one reserved pair carrying no skill body at all — the raw-prompt form:
#
#   sy-inline [<llm>] <prompt>      interactive raw prompt
#   sy-run-inline [<llm>] <prompt>  non-interactive raw prompt
#   <cli>_skill_inline <prompt>     interactive raw prompt
#   <cli>_skill_run_inline <prompt> non-interactive raw prompt
#
# The wrappers resolve two independent booleans. `SY_SKILL_INLINE=1` sends the
# full SKILL.md instead of naming the native skill. `SY_LLM_NON_INTERACTIVE=1`
# selects the CLI's print-and-exit surface. Both default to 0. The `run` wrapper
# families force only the second flag, so callers can still choose native or
# inline skill transport.
#
# The `sy-<name>` family mirrors the `EDITOR` convention used by `view_file` /
# `run_editor`:
#
#   1. First positional arg, if it names a known LLM CLI, picks that CLI and
#      gets stripped off the prompt argv.
#   2. Otherwise the `$LLM` env var picks the CLI.
#   3. Otherwise `$_SY_DEFAULT_LLM` (default `claude`).
#
# The `<cli>_skill_<name>` family exists so one CLI can be pinned without an
# override token, and so `opencode_skill_<TAB>` completes every skill that CLI
# can run. Hyphens in the skill name become underscores, matching the prefix.
#
# Example invocations:
#   sy-review-pr <pr-url>                # uses $LLM (default claude)
#   sy-review-pr opencode <pr-url>       # uses opencode for this call only
#   LLM=gemini sy-review-pr <pr-url>     # uses gemini via env override
#   opencode_skill_review_pr <pr-url>    # pinned to opencode
#   opencode_skill_run_review_pr <pr-url># print output and exit
#   claude_skill_review_pr <pr-url>      # pinned to claude
#   opencode_skill_inline "free text"    # raw prompt, no skill body
#   opencode_skill_run_inline "free text"# raw prompt, print output and exit
#   sy-inline gemini "free text"         # raw prompt, CLI picked at call time
#
# --- Skill transport and execution surface ---
#
# SY_SKILL_INLINE=0  Name the skill so the CLI loads its native files (default).
# SY_SKILL_INLINE=1  Send the full SKILL.md as an ordinary prompt.
# SY_LLM_NON_INTERACTIVE=0  Launch the interactive surface (default).
# SY_LLM_NON_INTERACTIVE=1  Print the result and exit.
#
# A surface without a verified native route falls back to inline transport.
#
# Prompt bodies live in `$LLM_ROOT_FOLDER/skills/sy-<name>/SKILL.md` — the ONE
# physical copy, deployed by `deploySharedLLMSkills()` from the shared
# `_common/commands/<name>.md` source and symlinked into every CLI's skills
# folder. Adding a new command:
#   1. Drop `_common/commands/<name>.md` + register in `LLM_COMMAND_DEPLOY_MAP`
#      (`software/scripts/advanced/llm/llm-common.js`) — one map, every CLI.
#   2. Re-run `bash run.sh --preset=llm` to deploy the body.
#   3. Open a new shell. The dispatcher loop below auto-registers `sy-<name>`
#      and every `<cli>_skill_<name>` from anything matching
#      `$LLM_ROOT_FOLDER/skills/sy-*/SKILL.md`, so no edit here is ever required.
#
# --- Where each thing is controlled ---
#
# WHICH skills exist and where they deploy   llm-common.js (LLM_COMMAND_DEPLOY_MAP)
# WHICH CLIs exist and how to invoke one     _SY_LLM_SPECS, below — nothing else
# WHICH wrappers get defined                 the glob in _sy_register_dispatchers
#
# No CLI name and no command name is written anywhere else in this file. Every
# function is generic and reads its argv shape out of the registry.
################################################################################

# --- Registry ---

# THE registry. One record per LLM CLI, and the ONLY place in this file that
# names a CLI or knows how to invoke one — every function below is generic and
# reads its argv shape from here. Record fields are `|` separated:
#
#   <cli>|<interactive-args>|<run-args>|<interactive-kind>|<interactive-native-args>|<run-kind>|<run-native-args>
#
#   interactive-args / run-args  Fixed argv before an ordinary prompt.
#   interactive-kind / run-kind  How that surface accepts a native skill:
#                  slash    resolves a leading `/<skill-name>` in prompt text.
#                  skill    resolves `/skill:<skill-name>` in prompt text.
#                  command  takes the name through a flag; see <native-args>.
#                  (empty)  no native surface — `native` mode degrades to
#                           `inline`, which always works.
#   interactive-native-args / run-native-args  Fixed argv before the native
#                prompt or command name. Empty = none.
#
# A native-kind is a CLAIM ABOUT A BINARY — verify it or leave it empty. An
# unproven `slash` silently sends `/sy-foo` as literal prose and the skill never
# loads, with no error anywhere. Evidence for the current values:
#   claude    slash    installed v2.1.289 help: `--bare` states "Skills still
#                      resolve via /skill-name"; positional prompts seed the TUI.
#   copilot   slash    runtime-verified print route; installed v1.0.92 help
#                      documents `-i` interactive and `-p` non-interactive.
#   gemini    slash    installed v0.62.0 source builds auto-executing `/name`
#                      commands that call `activate_skill`; help documents `-i`
#                      as executing the prompt before continuing interactively.
#   opencode  slash / command  runtime-verified interactive slash route and
#                      print route `opencode run --command sy-<name>`.
#   pi        skill    installed v1.0.4 docs specify `/skill:name <args>` to
#                      force-load a skill; help documents positional messages as
#                      initial interactive prompts.
#
# Adding a CLI is ONE record here and nothing else. Order matters only in that
# the first record is the default CLI (see _SY_DEFAULT_LLM below).
_SY_LLM_SPECS=(
  "claude||-p|slash||slash|-p"
  "copilot|-i|-p|slash|-i|slash|-p"
  "gemini|-i|-p|slash|-i||"
  "opencode|--prompt|run|slash|--prompt|command|run --command"
  "pi||-p|skill||||"
)

# Directory where the deployed prompt bodies live. Single canonical location
# is `$LLM_ROOT_FOLDER/skills/sy-*/SKILL.md`; every CLI skills folder and the
# `~/.config/opencode/commands/` mirror are symlinks pointing back here, so
# this stays authoritative regardless of which CLI you ultimately dispatch to.
#
# $LLM_ROOT_FOLDER is declared once in software/bootstrap/common-env.sh and
# re-exported into ~/.bash_syle_common, which is the same value llm-common.js
# deploys into. Never hardcode the folder here — that is how the two surfaces
# drift apart the next time the LLM home moves. Read it DIRECTLY: a `:-` default
# would be exactly that second declaration, and it would keep resolving to a
# stale path long after the real one moved instead of failing where you can see it.
_SY_SKILLS_DIR="${LLM_ROOT_FOLDER}/skills"

# Reserved wrapper name for the raw-prompt family — `sy-inline` and
# `<cli>_skill_inline`. Not a skill: nothing is read off disk, the arguments
# ARE the prompt. Named once here because every wrapper family shares it.
_SY_INLINE_NAME="inline"

# Canonical list of CLI names, derived from _SY_LLM_SPECS so the registry above
# stays the single source. Built once at source time — a function would fork a
# subshell on every dispatch for a list that never changes.
_SY_SUPPORTED_LLMS=()
for _sy_spec in "${_SY_LLM_SPECS[@]}"; do
  _SY_SUPPORTED_LLMS+=("${_sy_spec%%|*}")
done
unset _sy_spec

# CLI used when neither the leading positional override nor $LLM is set. Taken
# from the first registry record rather than restated, so no CLI name is
# hardcoded outside _SY_LLM_SPECS. Override per-shell via `export LLM=copilot`.
_SY_DEFAULT_LLM="${_SY_SUPPORTED_LLMS[0]}"

# --- Resolution helpers ---

# _sy_is_supported_llm: return 0 when $1 matches a known CLI name, 1 otherwise.
# Pure check — does NOT consume the arg.
function _sy_is_supported_llm() {
  local candidate="$1"
  local llm
  for llm in "${_SY_SUPPORTED_LLMS[@]}"; do
    [ "$candidate" = "$llm" ] && return 0
  done
  return 1
}

# _sy_load_spec: look CLI $1 up in _SY_LLM_SPECS and assign all execution fields
# into caller locals. Returns 1 when the CLI is not in the registry.
#
# Assigns into caller locals (bash dynamic scoping) rather than echoing so a
# dispatch costs no subshell fork, and parses with parameter expansion only —
# no `cut`, no `read`, no herestring.
#
# Callers MUST declare all six `_sy_*` fields as `local` before calling.
function _sy_load_spec() {
  local candidate="$1"
  local spec rest
  for spec in "${_SY_LLM_SPECS[@]}"; do
    [ "${spec%%|*}" = "$candidate" ] || continue
    rest="${spec#*|}"
    _sy_interactive_args="${rest%%|*}"
    rest="${rest#*|}"
    _sy_run_args="${rest%%|*}"
    rest="${rest#*|}"
    _sy_interactive_kind="${rest%%|*}"
    rest="${rest#*|}"
    _sy_interactive_native_args="${rest%%|*}"
    rest="${rest#*|}"
    _sy_run_kind="${rest%%|*}"
    _sy_run_native_args="${rest#*|}"
    return 0
  done
  return 1
}

# _sy_native_kind: stdout the native dispatch kind for CLI $1, or nothing when
# that CLI has no native surface. Thin read-only view over _sy_load_spec, kept
# so callers that only care about the kind don't declare three throwaway locals.
function _sy_native_kind() {
  local _sy_interactive_args _sy_run_args _sy_interactive_kind
  local _sy_interactive_native_args _sy_run_kind _sy_run_native_args
  _sy_load_spec "$1" || return 1
  echo "$_sy_interactive_kind"
}

# _sy_resolve_llm: stdout the CLI name to dispatch with, given an explicit
# override (or empty) as $1. Resolution order matches the docstring above:
#   1. Explicit positional override (already classified by _sy_dispatch).
#   2. $LLM env var.
#   3. $_SY_DEFAULT_LLM.
# Always echoes a value — falls through to the default on any unknown input.
function _sy_resolve_llm() {
  local override="${1:-}"
  if [ -n "$override" ] && _sy_is_supported_llm "$override"; then
    echo "$override"
    return 0
  fi
  if [ -n "${LLM:-}" ] && _sy_is_supported_llm "$LLM"; then
    echo "$LLM"
    return 0
  fi
  echo "$_SY_DEFAULT_LLM"
}

# _sy_resolve_boolean: normalize $1 through is_truthy, defaulting unset to $2.
function _sy_resolve_boolean() {
  local value="${1:-}"
  local fallback="$2"
  [ -z "$value" ] && value="$fallback"
  is_truthy "$value"
}

# _sy_announce_launch: print route and both boolean controls before execution.
# Sleeps three seconds only for an interactive terminal; redirected/scripted
# callers still receive the preamble but do not pay an artificial delay.
function _sy_announce_launch() {
  local route="$1"
  local inline="$2"
  local non_interactive="$3"
  if type -t hr > /dev/null 2>&1; then
    hr >&2
  else
    echo "$LINE_BREAK_EQUAL" >&2
  fi
  if type -t h1 > /dev/null 2>&1; then
    h1 "LLM skill launch" >&2
    h2 "Command: $route" >&2
  else
    echo "LLM skill launch" >&2
    echo "Command: $route" >&2
  fi
  echo "SY_SKILL_INLINE=$inline (0=native skill, 1=inline SKILL.md)" >&2
  echo "SY_LLM_NON_INTERACTIVE=$non_interactive (0=interactive, 1=print and exit)" >&2
  if [ -t 2 ]; then
    echo "Starting in 3 seconds..." >&2
    sleep 3
  fi
  if type -t hr > /dev/null 2>&1; then
    hr >&2
  else
    echo "$LINE_BREAK_EQUAL" >&2
  fi
}

# --- Prompt body ---

# _sy_assert_skill: return 0 when `sy-<name>` has a deployed SKILL.md, else
# print a hint to stderr and return 1.
function _sy_assert_skill() {
  local name="$1"
  local body_file="$_SY_SKILLS_DIR/sy-$name/SKILL.md"
  if [ ! -f "$body_file" ]; then
    echo "sy-$name: prompt body missing at $body_file (run \`bash run.sh --preset=llm\` first)" >&2
    return 1
  fi
  return 0
}

# _sy_load_prompt_body: stdout the prompt body for `<name>` from disk.
# Returns 1 (with stderr message) when the body file is missing.
function _sy_load_prompt_body() {
  local name="$1"
  _sy_assert_skill "$name" || return 1
  command cat "$_SY_SKILLS_DIR/sy-$name/SKILL.md"
}

# _sy_apply_arguments: substitute the forwarded prompt arguments into the body.
# When the body literally references `$ARGUMENTS`, the placeholder is replaced.
# Otherwise (and only when at least one arg was forwarded) the args are
# appended as a trailing `Arguments: ...` line. Bodies that explicitly handle
# argless invocation are left alone in the no-arg case.
function _sy_apply_arguments() {
  local body="$1"
  shift
  if [[ "$body" == *'$ARGUMENTS'* ]]; then
    local joined="$*"
    # Quote the replacement: bash 5.2+ patsub_replacement expands a bare `&`
    # in it to the matched text, corrupting args like `?a=1&b=2`.
    printf '%s' "${body//\$ARGUMENTS/"$joined"}"
  elif [ $# -gt 0 ]; then
    printf '%s\n\nArguments: %s' "$body" "$*"
  else
    printf '%s' "$body"
  fi
}

# --- Execution ---

# _sy_exec_prompt: execute CLI $1 with fixed argv $2 and prompt $3.
#
# Args:
#   $1 = CLI name
#   $2 = whitespace-separated fixed argv from the registry
#   $3 = prompt text
function _sy_exec_prompt() {
  local llm="$1"
  local fixed_args="$2"
  local prompt="$3"
  local argv token
  argv=("$llm")
  for token in $fixed_args; do
    argv+=("$token")
  done
  argv+=("$prompt")
  "${argv[@]}"
}

# _sy_exec_native: invoke a native prompt or named command with fixed argv.
#
# Args:
#   $1 = CLI name
#   $2 = whitespace-separated fixed argv from the registry
#   $3 = native skill prompt or full skill name
#   $4..$N = forwarded arguments for the `command` kind only
function _sy_exec_native() {
  local llm="$1"
  local fixed_args="$2"
  local skill="$3"
  shift 3
  local argv token
  argv=("$llm")
  for token in $fixed_args; do
    argv+=("$token")
  done
  argv+=("$skill")
  "${argv[@]}" "$@"
}

# --- Inline (raw prompt) entry points ---

# _sy_help_inline: print help for one raw-prompt wrapper.
#
# Args:
#   $1 = the function name being described
#   $2 = pinned CLI name, or empty when chosen at call time
#   $3 = 1 for non-interactive output, else 0
function _sy_help_inline() {
  local fn="$1"
  local pinned="${2:-}"
  local non_interactive="${3:-0}"
  local surface="interactive"
  [ "$non_interactive" = "1" ] && surface="non-interactive"
  if [ -n "$pinned" ]; then
    echo "$fn: send a raw prompt to $pinned ($surface)
  Usage: $fn <prompt...>

prompt...  Joined with spaces and passed as the CLI's initial prompt. No SKILL.md is read.

  CLI is pinned to '$pinned' — use sy-$_SY_INLINE_NAME to pick one at call time."
  else
    echo "$fn: send a raw prompt to the chosen LLM CLI ($surface)
  Usage: $fn [<llm>] <prompt...>
         LLM=<llm> $fn <prompt...>

  <llm>      One of: ${_SY_SUPPORTED_LLMS[*]} (default: \$LLM or '$_SY_DEFAULT_LLM').
  prompt...  Joined with spaces and passed as the CLI's initial prompt. No
             SKILL.md is read.

  Pinned per-CLI variants exist too: ${_SY_SUPPORTED_LLMS[0]}_skill_$_SY_INLINE_NAME (etc)."
  fi
}

# _sy_dispatch_inline: top-level entry for a pinned raw-prompt wrapper.
#
# Args:
#   $1 = CLI name
#   $2 = 1 for non-interactive output, else 0
#   $3..$N = prompt words
function _sy_dispatch_inline() {
  local llm="$1"
  local non_interactive="$2"
  shift 2
  if is_help_arg "${1:-}"; then
    local infix=""
    [ "$non_interactive" = "1" ] && infix="run_"
    _sy_help_inline "${llm}_skill_${infix}${_SY_INLINE_NAME}" "$llm" "$non_interactive"
    return 0
  fi
  if [ $# -eq 0 ]; then
    echo "${llm}_skill_${_SY_INLINE_NAME}: no prompt given (see --help)" >&2
    return 1
  fi
  local _sy_interactive_args _sy_run_args _sy_interactive_kind
  local _sy_interactive_native_args _sy_run_kind _sy_run_native_args
  _sy_load_spec "$llm" || return 1
  if [ "$non_interactive" != "1" ] && _sy_resolve_boolean "${SY_LLM_NON_INTERACTIVE:-}" 0; then
    non_interactive=1
  fi
  local fixed_args="$_sy_interactive_args"
  [ "$non_interactive" = "1" ] && fixed_args="$_sy_run_args"
  _sy_exec_prompt "$llm" "$fixed_args" "$*"
}

# _sy_dispatch_inline_any: top-level entry for sy-inline. Pulls a leading CLI
# override off argv exactly like _sy_dispatch, then delegates to that CLI's own
# pinned wrapper so the two families share one exec path.
function _sy_dispatch_inline_any() {
  local non_interactive="$1"
  shift
  if is_help_arg "${1:-}"; then
    local prefix="sy-"
    [ "$non_interactive" = "1" ] && prefix="sy-run-"
    _sy_help_inline "${prefix}${_SY_INLINE_NAME}" "" "$non_interactive"
    return 0
  fi
  local override=""
  if [ $# -gt 0 ] && _sy_is_supported_llm "$1"; then
    override="$1"
    shift
  fi
  local llm
  llm=$(_sy_resolve_llm "$override")
  if [ $# -eq 0 ]; then
    echo "sy-$_SY_INLINE_NAME: no prompt given (see --help)" >&2
    return 1
  fi
  if [ "$non_interactive" != "1" ] && _sy_resolve_boolean "${SY_LLM_NON_INTERACTIVE:-}" 0; then
    non_interactive=1
  fi
  local _sy_interactive_args _sy_run_args _sy_interactive_kind
  local _sy_interactive_native_args _sy_run_kind _sy_run_native_args
  _sy_load_spec "$llm" || return 1
  local route_args="$_sy_interactive_args"
  [ "$non_interactive" = "1" ] && route_args="$_sy_run_args"
  _sy_announce_launch "$llm${route_args:+ $route_args} <prompt>" 1 "$non_interactive"
  _sy_dispatch_inline "$llm" "$non_interactive" "$*"
}

# _sy_run: resolve CLI, skill transport, and execution surface, then dispatch.
#
# Args:
#   $1 = command name (matches `$LLM_ROOT_FOLDER/skills/sy-<name>/SKILL.md`)
#   $_SY_LLM (caller-set local) = pre-classified CLI override (or empty)
#   $_SY_FORCE_NON_INTERACTIVE (caller-set local) = 1 for `run` wrappers
#   $2..$N = forwarded prompt arguments
function _sy_run() {
  local name="$1"
  shift
  local llm
  llm=$(_sy_resolve_llm "${_SY_LLM:-}")
  local _sy_interactive_args _sy_run_args _sy_interactive_kind
  local _sy_interactive_native_args _sy_run_kind _sy_run_native_args
  if ! _sy_load_spec "$llm"; then
    echo "sy-$name: '$llm' is not in _SY_LLM_SPECS" >&2
    return 1
  fi
  local non_interactive=0
  if [ "${_SY_FORCE_NON_INTERACTIVE:-0}" = "1" ] || _sy_resolve_boolean "${SY_LLM_NON_INTERACTIVE:-}" 0; then
    non_interactive=1
  fi
  local prompt_args="$_sy_interactive_args"
  local kind="$_sy_interactive_kind"
  local native_args="$_sy_interactive_native_args"
  if [ "$non_interactive" = "1" ]; then
    prompt_args="$_sy_run_args"
    kind="$_sy_run_kind"
    native_args="$_sy_run_native_args"
  fi
  local inline=0
  _sy_resolve_boolean "${SY_SKILL_INLINE:-}" 0 && inline=1
  if [ "$inline" = "0" ] && [ -n "$kind" ]; then
    _sy_assert_skill "$name" || return 1
    if [ "$kind" = "command" ]; then
      local command_route="$llm $native_args sy-$name"
      [ $# -gt 0 ] && command_route="$command_route $*"
      _sy_announce_launch "$command_route" 0 "$non_interactive"
      _sy_exec_native "$llm" "$native_args" "sy-$name" "$@"
      return $?
    fi
    local slash="/sy-$name"
    [ "$kind" = "skill" ] && slash="/skill:sy-$name"
    if [ $# -gt 0 ]; then
      slash="$slash $*"
    fi
    _sy_announce_launch "$llm${native_args:+ $native_args} $slash" 0 "$non_interactive"
    _sy_exec_native "$llm" "$native_args" "$slash"
    return $?
  fi
  local body
  body=$(_sy_load_prompt_body "$name") || return 1
  local prompt
  prompt=$(_sy_apply_arguments "$body" "$@")
  _sy_announce_launch "$llm${prompt_args:+ $prompt_args} <SKILL.md>" 1 "$non_interactive"
  _sy_exec_prompt "$llm" "$prompt_args" "$prompt"
}

# --- Entry points ---

# _sy_help: print inline help for one wrapper. Shared by both families so the
# help text can never drift between them.
#
# Args:
#   $1 = the function name being described
#   $2 = command name (without the `sy-` prefix)
#   $3 = pinned CLI name, or empty when the CLI is chosen at call time
function _sy_help() {
  local fn="$1"
  local name="$2"
  local pinned="${3:-}"
  if [ -n "$pinned" ]; then
    echo "$fn: run the sy-$name workflow through $pinned
  Usage: $fn [args...]

  args...    Forwarded to the prompt; substituted into \$ARGUMENTS where the body
             references it, otherwise appended as a trailing \`Arguments: ...\` line.

  CLI is pinned to '$pinned' — use sy-$name to pick one at call time instead."
  else
    echo "$fn: dispatch the sy-$name workflow via the chosen LLM CLI
  Usage: $fn [<llm>] [args...]
         LLM=<llm> $fn [args...]

  <llm>      One of: ${_SY_SUPPORTED_LLMS[*]} (default: \$LLM or '$_SY_DEFAULT_LLM').
  args...    Forwarded to the prompt; substituted into \$ARGUMENTS where the body
             references it, otherwise appended as a trailing \`Arguments: ...\` line.

  Pinned per-CLI variants exist too: ${_SY_SUPPORTED_LLMS[0]}_skill_${name//-/_} (etc)."
  fi
  echo "
  SY_SKILL_INLINE          0 (default) uses native skill loading; 1 sends the
                           full SKILL.md. Unsupported native surfaces fall back.
  SY_LLM_NON_INTERACTIVE   0 (default) opens the interactive CLI; 1 prints output
                           and exits. The *_skill_run_* wrappers force 1.

  Body is loaded from $_SY_SKILLS_DIR/sy-$name/SKILL.md (deployed by any CLI's setup.js).
  Re-run \`bash run.sh --preset=llm\` to refresh if the body is stale."
}

# _sy_dispatch: top-level entry per sy-<name>. Pulls a leading CLI override
# off argv, sets _SY_LLM locally, then delegates to _sy_run.
function _sy_dispatch() {
  local name="$1"
  shift
  local _SY_FORCE_NON_INTERACTIVE="${_SY_FORCE_NON_INTERACTIVE:-0}"
  if is_help_arg "${1:-}"; then
    local prefix="sy-"
    [ "$_SY_FORCE_NON_INTERACTIVE" = "1" ] && prefix="sy-run-"
    _sy_help "${prefix}${name}" "$name" ""
    return 0
  fi
  local _SY_LLM=""
  if [ $# -gt 0 ] && _sy_is_supported_llm "$1"; then
    _SY_LLM="$1"
    shift
  fi
  _sy_run "$name" "$@"
}

# _sy_dispatch_cli: top-level entry per <cli>_skill_<name>. The CLI is baked
# into the function name, so argv is never scanned for an override — every arg
# goes to the prompt.
#
# Args:
#   $1 = CLI name
#   $2 = command name (without the `sy-` prefix)
#   $3 = 1 to force non-interactive output, else 0
#   $4..$N = forwarded prompt arguments
function _sy_dispatch_cli() {
  local llm="$1"
  local name="$2"
  local force_non_interactive="$3"
  shift 3
  if is_help_arg "${1:-}"; then
    local infix=""
    [ "$force_non_interactive" = "1" ] && infix="run_"
    _sy_help "${llm}_skill_${infix}${name//-/_}" "$name" "$llm"
    return 0
  fi
  local _SY_LLM="$llm"
  local _SY_FORCE_NON_INTERACTIVE="$force_non_interactive"
  _sy_run "$name" "$@"
}

# --- Registration ---

# Auto-register interactive and non-interactive call-time and pinned wrappers.
# Idempotent — re-running the loop redefines the same wrappers. When the skills
# dir is absent (e.g. on a machine where no setup.js has ever run), the glob
# expands to its own pattern and we skip it; the inline family is still defined.
function _sy_register_dispatchers() {
  local skill_file skill_folder base name flat llm defs
  # Raw-prompt family first: no SKILL.md is involved, so these exist even on a
  # machine where nothing has been deployed yet.
  defs="function sy-${_SY_INLINE_NAME}() { _sy_dispatch_inline_any 0 \"\$@\"; }; function sy-run-${_SY_INLINE_NAME}() { _sy_dispatch_inline_any 1 \"\$@\"; };"
  for llm in "${_SY_SUPPORTED_LLMS[@]}"; do
    defs="${defs} function ${llm}_skill_${_SY_INLINE_NAME}() { _sy_dispatch_inline '${llm}' 0 \"\$@\"; }; function ${llm}_skill_run_${_SY_INLINE_NAME}() { _sy_dispatch_inline '${llm}' 1 \"\$@\"; };"
  done
  eval "$defs"
  for skill_file in "$_SY_SKILLS_DIR"/sy-*/SKILL.md; do
    [ -f "$skill_file" ] || continue
    # `${var%/*}` / `${var##*/}`, not `$(dirname)` / `$(basename)` — this loop
    # runs at every shell start, and a command substitution forks a subshell
    # plus an exec per file. At ~23 commands that was ~100ms of startup, for a
    # string operation bash does natively.
    skill_folder="${skill_file%/*}"
    base="${skill_folder##*/}"
    name="${base#sy-}"
    # `inline` is reserved by the raw-prompt family above. Letting a skill of
    # that name redefine `<cli>_skill_inline` would point it back at _sy_run,
    # which execs through `<cli>_skill_inline` — infinite recursion.
    if [ "$name" = "$_SY_INLINE_NAME" ]; then
      echo "sy-commands: skipping reserved skill name 'sy-$_SY_INLINE_NAME' ($skill_file)" >&2
      continue
    fi
    # Hyphens can't follow the `<cli>_skill_` prefix without reading as a typo,
    # so the pinned family flattens them: sy-review-pr -> claude_skill_review_pr.
    flat="${name//-/_}"
    # One `eval` per skill defines both call-time wrappers and both pinned
    # wrappers per CLI, avoiding one eval per generated function.
    defs="function sy-${name}() { _sy_dispatch '${name}' \"\$@\"; }; function sy-run-${name}() { local _SY_FORCE_NON_INTERACTIVE=1; _sy_dispatch '${name}' \"\$@\"; };"
    for llm in "${_SY_SUPPORTED_LLMS[@]}"; do
      defs="${defs} function ${llm}_skill_${flat}() { _sy_dispatch_cli '${llm}' '${name}' 0 \"\$@\"; }; function ${llm}_skill_run_${flat}() { _sy_dispatch_cli '${llm}' '${name}' 1 \"\$@\"; };"
    done
    eval "$defs"
  done
}
_sy_register_dispatchers
