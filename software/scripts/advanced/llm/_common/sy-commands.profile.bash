#!/usr/bin/env bash

################################################################################
# --- sy-* skill dispatchers (shared across all four LLM CLIs) ---
#
# Bash wrappers around every `_common/commands/<name>.md` so the same workflow
# can be invoked from the terminal without entering a CLI's TUI. Two families
# are auto-registered per skill, both driven by the same code:
#
#   sy-<name>                    CLI chosen at call time (EDITOR convention)
#   <cli>_skill_<name>           CLI baked into the function name
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
#   claude_skill_review_pr <pr-url>      # pinned to claude
#
# --- Dispatch modes: inline (default) vs native ---
#
# inline  Read the skill body off disk and hand the whole text to the CLI as an
#         ordinary prompt. Works on every CLI, needs nothing deployed into that
#         CLI's own skills folder, and is therefore the default.
# native  Name the skill and let the CLI resolve it through its own machinery
#         (frontmatter, `references/`, `scripts/`). Short command line and the
#         CLI's real skill loader, but only some CLIs expose the surface — see
#         `_SY_LLM_SPECS` below. A CLI with no native surface falls back to
#         inline, so `native` is always safe to set globally.
#
#   SY_SKILL_MODE=native sy-review-pr <pr-url>
#   export SY_SKILL_MODE=native          # opt in for the whole shell
#
# Prompt bodies live in `~/sy_llm_ai/skills/sy-<name>/SKILL.md` — the ONE
# physical copy, deployed by `deploySharedLLMSkills()` from the shared
# `_common/commands/<name>.md` source and symlinked into every CLI's skills
# folder. Adding a new command:
#   1. Drop `_common/commands/<name>.md` + register in `LLM_COMMAND_DEPLOY_MAP`
#      (`software/scripts/advanced/llm/llm-common.js`) — one map, every CLI.
#   2. Re-run `bash run.sh --preset=llm` to deploy the body.
#   3. Open a new shell. The dispatcher loop below auto-registers `sy-<name>`
#      and every `<cli>_skill_<name>` from anything matching
#      `~/sy_llm_ai/skills/sy-*/SKILL.md`, so no edit here is ever required.
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

# Default dispatch mode. `inline` is the only shape every CLI supports, so it
# is the floor; override per-call or per-shell with $SY_SKILL_MODE.
_SY_DEFAULT_SKILL_MODE="inline"

# THE registry. One record per LLM CLI, and the ONLY place in this file that
# names a CLI or knows how to invoke one — every function below is generic and
# reads its argv shape from here. Record fields are `|` separated:
#
#   <cli>|<prompt-args>|<native-kind>|<native-args>
#
#   cli          Binary name, also the `<cli>_skill_<name>` wrapper prefix and
#                the accepted `$LLM` / positional-override token.
#   prompt-args  Fixed argv tokens between the binary and the prompt, which is
#                always passed as the single LAST argument. Empty = none.
#   native-kind  How this CLI can be handed a skill NAME instead of a body:
#                  slash    resolves a leading `/<skill-name>` in prompt text,
#                           so it reuses <prompt-args> and needs no extra args.
#                  command  takes the name through a flag; see <native-args>.
#                  (empty)  no native surface — `native` mode degrades to
#                           `inline`, which always works.
#   native-args  Fixed argv tokens for the `command` kind, followed by the skill
#                name and then the forwarded args. Only read when kind=command.
#
# A native-kind is a CLAIM ABOUT A BINARY — verify it or leave it empty. An
# unproven `slash` silently sends `/sy-foo` as literal prose and the skill never
# loads, with no error anywhere. Evidence for the current values:
#   claude    slash    documented: `--disable-slash-commands` toggles it off and
#                      `--bare` states "Skills still resolve via /skill-name".
#                      Not runtime-verified here (no API key on the test host).
#   copilot   slash    runtime-verified v1.0.81: `copilot -p "/sy-<name>"` fired
#                      `skill(sy-<name>)` and returned the skill's output.
#   gemini    (empty)  no `--command` flag and no documented slash handling for
#                      `-p`; left unset so it degrades to inline rather than
#                      shipping an unproven claim.
#   opencode  command  runtime-verified: `opencode run --command sy-<name>`
#                      returned the skill's output. Flag is documented in
#                      `opencode run --help`.
#
# Adding a CLI is ONE record here and nothing else. Order matters only in that
# the first record is the default CLI (see _SY_DEFAULT_LLM below).
_SY_LLM_SPECS=(
  "claude||slash|"
  "copilot|-p|slash|"
  "gemini|-p||"
  "opencode|run|command|run --command"
)

# Directory where the deployed prompt bodies live. Single canonical location
# is `~/sy_llm_ai/skills/sy-*/SKILL.md`; every CLI skills folder and the
# `~/.config/opencode/commands/` mirror are symlinks pointing back here, so
# this stays authoritative regardless of which CLI you ultimately dispatch to.
_SY_SKILLS_DIR="$HOME/sy_llm_ai/skills"

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

# _sy_load_spec: look CLI $1 up in _SY_LLM_SPECS and ASSIGN its fields to the
# caller's `_sy_prompt_args` / `_sy_kind` / `_sy_native_args` locals. Returns 1
# when the CLI is not in the registry.
#
# Assigns into caller locals (bash dynamic scoping) rather than echoing so a
# dispatch costs no subshell fork, and parses with parameter expansion only —
# no `cut`, no `read`, no herestring.
#
# Callers MUST declare all three as `local` before calling.
function _sy_load_spec() {
  local candidate="$1"
  local spec rest
  for spec in "${_SY_LLM_SPECS[@]}"; do
    [ "${spec%%|*}" = "$candidate" ] || continue
    rest="${spec#*|}"
    _sy_prompt_args="${rest%%|*}"
    rest="${rest#*|}"
    _sy_kind="${rest%%|*}"
    _sy_native_args="${rest#*|}"
    return 0
  done
  return 1
}

# _sy_native_kind: stdout the native dispatch kind for CLI $1, or nothing when
# that CLI has no native surface. Thin read-only view over _sy_load_spec, kept
# so callers that only care about the kind don't declare three throwaway locals.
function _sy_native_kind() {
  local _sy_prompt_args _sy_kind _sy_native_args
  _sy_load_spec "$1" || return 1
  echo "$_sy_kind"
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

# _sy_resolve_mode: stdout `inline` or `native`. Unknown values for
# $SY_SKILL_MODE fall back to the default rather than failing the call.
function _sy_resolve_mode() {
  case "${SY_SKILL_MODE:-}" in
  inline | native) echo "$SY_SKILL_MODE" ;;
  *) echo "$_SY_DEFAULT_SKILL_MODE" ;;
  esac
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
    printf '%s' "${body//\$ARGUMENTS/$joined}"
  elif [ $# -gt 0 ]; then
    printf '%s\n\nArguments: %s' "$body" "$*"
  else
    printf '%s' "$body"
  fi
}

# --- Execution ---

# _sy_exec_prompt: hand a fully-rendered prompt to CLI $1. Covers BOTH the
# `inline` mode (prompt = the whole skill body) and the `slash` native kind
# (prompt = `/<skill> <args>`) — same argv shape, different text.
#
# Fully generic: the fixed tokens between the binary and the prompt come from
# the registry, never from a `case` on the CLI name. Those tokens are literal
# flags we author, so splitting them on whitespace is intentional; the prompt
# itself is always one quoted argument and is never split.
#
# Args:
#   $1 = CLI name
#   $2 = prompt text
function _sy_exec_prompt() {
  local llm="$1"
  local prompt="$2"
  local _sy_prompt_args _sy_kind _sy_native_args
  if ! _sy_load_spec "$llm"; then
    echo "sy: '$llm' is not in _SY_LLM_SPECS" >&2
    return 1
  fi
  local argv token
  argv=("$llm")
  for token in $_sy_prompt_args; do
    argv+=("$token")
  done
  argv+=("$prompt")
  "${argv[@]}"
}

# _sy_exec_named: invoke a skill by NAME through a CLI whose native kind is
# `command` — fixed registry tokens, then the skill name, then the args.
#
# Args:
#   $1 = CLI name
#   $2 = full skill name, `sy-` prefix included
#   $3..$N = forwarded arguments
function _sy_exec_named() {
  local llm="$1"
  local skill="$2"
  shift 2
  local _sy_prompt_args _sy_kind _sy_native_args
  if ! _sy_load_spec "$llm"; then
    echo "sy: '$llm' is not in _SY_LLM_SPECS" >&2
    return 1
  fi
  local argv token
  argv=("$llm")
  for token in $_sy_native_args; do
    argv+=("$token")
  done
  argv+=("$skill")
  "${argv[@]}" "$@"
}

# _sy_run: resolve the CLI and the mode, then dispatch `<name>`. Echoes the
# routing decision to stderr so the user can verify which CLI fired and whether
# the skill was inlined or named.
#
# The three-way choice below is the whole dispatch policy, in one place:
#   native + command  -> hand the CLI the skill NAME through its own flag
#   native + slash    -> hand the CLI `/<skill> <args>` as prompt text
#   anything else     -> inline the body (also where a CLI with no native
#                        surface, or an unknown $SY_SKILL_MODE, lands)
#
# Args:
#   $1 = command name (matches `~/sy_llm_ai/skills/sy-<name>/SKILL.md`)
#   $_SY_LLM (caller-set local) = pre-classified CLI override (or empty)
#   $2..$N = forwarded prompt arguments
function _sy_run() {
  local name="$1"
  shift
  local llm
  llm=$(_sy_resolve_llm "${_SY_LLM:-}")
  local _sy_prompt_args _sy_kind _sy_native_args
  if ! _sy_load_spec "$llm"; then
    echo "sy-$name: '$llm' is not in _SY_LLM_SPECS" >&2
    return 1
  fi
  local mode
  mode=$(_sy_resolve_mode)
  if [ "$mode" = "native" ] && [ -n "$_sy_kind" ]; then
    _sy_assert_skill "$name" || return 1
    echo ">> sy-$name -> $llm (native/$_sy_kind)" >&2
    if [ "$_sy_kind" = "command" ]; then
      _sy_exec_named "$llm" "sy-$name" "$@"
      return $?
    fi
    local slash="/sy-$name"
    if [ $# -gt 0 ]; then
      slash="$slash $*"
    fi
    _sy_exec_prompt "$llm" "$slash"
    return $?
  fi
  local body
  body=$(_sy_load_prompt_body "$name") || return 1
  local prompt
  prompt=$(_sy_apply_arguments "$body" "$@")
  echo ">> sy-$name -> $llm (inline)" >&2
  _sy_exec_prompt "$llm" "$prompt"
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
  SY_SKILL_MODE   'inline' (default) sends the whole body as a prompt; 'native'
                  names the skill and lets the CLI resolve it. CLIs with no
                  native surface fall back to inline.

  Body is loaded from $_SY_SKILLS_DIR/sy-$name/SKILL.md (deployed by any CLI's setup.js).
  Re-run \`bash run.sh --preset=llm\` to refresh if the body is stale."
}

# _sy_dispatch: top-level entry per sy-<name>. Pulls a leading CLI override
# off argv, sets _SY_LLM locally, then delegates to _sy_run.
function _sy_dispatch() {
  local name="$1"
  shift
  if is_help_arg "${1:-}"; then
    _sy_help "sy-$name" "$name" ""
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
#   $3..$N = forwarded prompt arguments
function _sy_dispatch_cli() {
  local llm="$1"
  local name="$2"
  shift 2
  if is_help_arg "${1:-}"; then
    _sy_help "${llm}_skill_${name//-/_}" "$name" "$llm"
    return 0
  fi
  local _SY_LLM="$llm"
  _sy_run "$name" "$@"
}

# --- Registration ---

# Auto-register `sy-<name>` plus one `<cli>_skill_<name>` per CLI for every
# `~/sy_llm_ai/skills/sy-*/SKILL.md` on disk. Idempotent — re-running the loop
# redefines the same wrappers. When the skills dir is absent (e.g. on a machine
# where no setup.js has ever run), the glob expands to its own pattern and we
# skip it.
function _sy_register_dispatchers() {
  local skill_file skill_folder base name flat llm defs
  for skill_file in "$_SY_SKILLS_DIR"/sy-*/SKILL.md; do
    [ -f "$skill_file" ] || continue
    # `${var%/*}` / `${var##*/}`, not `$(dirname)` / `$(basename)` — this loop
    # runs at every shell start, and a command substitution forks a subshell
    # plus an exec per file. At ~23 commands that was ~100ms of startup, for a
    # string operation bash does natively.
    skill_folder="${skill_file%/*}"
    base="${skill_folder##*/}"
    name="${base#sy-}"
    # Hyphens can't follow the `<cli>_skill_` prefix without reading as a typo,
    # so the pinned family flattens them: sy-review-pr -> claude_skill_review_pr.
    flat="${name//-/_}"
    # One `eval` per skill defining all five wrappers, not five evals — measured
    # indistinguishable from the single-wrapper loop it replaced (~7ms for 23).
    defs="function sy-${name}() { _sy_dispatch '${name}' \"\$@\"; };"
    for llm in "${_SY_SUPPORTED_LLMS[@]}"; do
      defs="${defs} function ${llm}_skill_${flat}() { _sy_dispatch_cli '${llm}' '${name}' \"\$@\"; };"
    done
    eval "$defs"
  done
}
_sy_register_dispatchers
