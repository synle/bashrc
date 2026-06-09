#!/usr/bin/env bash

################################################################################
# ---- sy-* slash command dispatchers (shared across all four LLM CLIs) ----
#
# Bash wrappers around every `_common/commands/<name>.md` so the same workflow
# can be invoked from the terminal without entering a CLI's TUI. Mirrors the
# `EDITOR` convention used by `view_file` / `run_editor`:
#
#   1. First positional arg, if it names a known LLM CLI, picks that CLI and
#      gets stripped off the prompt argv.
#   2. Otherwise the `$LLM` env var picks the CLI.
#   3. Otherwise `$_SY_DEFAULT_LLM` (default `claude`).
#
# Example invocations:
#   sy-review-pr <pr-url>                # uses $LLM (default claude)
#   sy-review-pr opencode <pr-url>       # uses opencode for this call only
#   LLM=gemini sy-review-pr <pr-url>     # uses gemini via env override
#
# Prompt bodies live in `~/.claude/commands/sy-<name>.md` — deployed there by
# `claude/setup.js` from the shared `_common/commands/<name>.md` source, so the
# command corpus stays single-sourced. Adding a new command:
#   1. Drop `_common/commands/<name>.md` + register in `CLAUDE_COMMAND_DEPLOY_MAP`.
#   2. Re-run `bash run.sh --files=claude/setup.js` to deploy the body.
#   3. Open a new shell. The dispatcher loop below auto-registers `sy-<name>`
#      from anything matching `~/.claude/commands/sy-*.md`, so no edit here is
#      ever required.
################################################################################

# Default CLI when neither the leading positional override nor $LLM is set.
# Override globally via `export LLM=copilot` (etc.) or per-call as $1.
_SY_DEFAULT_LLM="claude"

# Canonical list of LLM CLIs this dispatcher knows how to drive. Adding a CLI
# requires (a) an entry here, (b) a `case` arm in `_sy_run`, and (c) a
# matching CLI binary present on PATH. Keep in sync with the parity matrix in
# software/scripts/advanced/llm/llm.md.
_SY_SUPPORTED_LLMS=(claude copilot gemini opencode)

# Directory where the deployed prompt bodies live. Single canonical location
# is `~/.claude/commands/sy-*.md` (deployed by claude/setup.js); the
# `~/.config/opencode/commands/` symlinks pulled in by opencode/setup.js
# point straight back here, so this stays authoritative regardless of which
# CLI you ultimately dispatch to.
_SY_COMMANDS_DIR="$HOME/.claude/commands"

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

# _sy_load_prompt_body: stdout the prompt body for `<name>` from disk.
# Returns 1 (with stderr message) when the body file is missing.
function _sy_load_prompt_body() {
  local name="$1"
  local body_file="$_SY_COMMANDS_DIR/sy-$name.md"
  if [ ! -f "$body_file" ]; then
    echo "sy-$name: prompt body missing at $body_file (run \`bash run.sh --files=claude/setup.js\` first)" >&2
    return 1
  fi
  command cat "$body_file"
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

# _sy_run: load the prompt body for `<name>`, substitute args, dispatch to the
# resolved CLI. Echoes the chosen CLI to stderr so the user can verify the
# routing.
#
# Args:
#   $1 = command name (matches `~/.claude/commands/sy-<name>.md`)
#   $_SY_LLM (caller-set local) = pre-classified CLI override (or empty)
#   $2..$N = forwarded prompt arguments
function _sy_run() {
  local name="$1"
  shift
  local llm
  llm=$(_sy_resolve_llm "${_SY_LLM:-}")
  local body
  body=$(_sy_load_prompt_body "$name") || return 1
  local prompt
  prompt=$(_sy_apply_arguments "$body" "$@")
  echo ">> sy-$name -> $llm" >&2
  case "$llm" in
  claude) claude "$prompt" ;;
  copilot) copilot -p "$prompt" ;;
  gemini) gemini -p "$prompt" ;;
  opencode) opencode run "$prompt" ;;
  *)
    echo "sy-$name: no dispatch arm for '$llm'" >&2
    return 1
    ;;
  esac
}

# _sy_dispatch: top-level entry per sy-<name>. Pulls a leading CLI override
# off argv, sets _SY_LLM locally, then delegates to _sy_run.
function _sy_dispatch() {
  local name="$1"
  shift
  if is_help_arg "${1:-}"; then
    echo "sy-$name: dispatch the /sy-$name workflow via the chosen LLM CLI
  Usage: sy-$name [<llm>] [args...]
         LLM=<llm> sy-$name [args...]

  <llm>      One of: ${_SY_SUPPORTED_LLMS[*]} (default: \$LLM or '$_SY_DEFAULT_LLM').
  args...    Forwarded to the prompt; substituted into \$ARGUMENTS where the body
             references it, otherwise appended as a trailing \`Arguments: ...\` line.

  Body is loaded from $_SY_COMMANDS_DIR/sy-$name.md (deployed by claude/setup.js).
  Re-run \`bash run.sh --files=claude/setup.js\` to refresh if the body is stale."
    return 0
  fi
  local _SY_LLM=""
  if [ $# -gt 0 ] && _sy_is_supported_llm "$1"; then
    _SY_LLM="$1"
    shift
  fi
  _sy_run "$name" "$@"
}

# Auto-register a `sy-<name>` function for every `~/.claude/commands/sy-*.md`
# on disk. Idempotent — re-running the loop redefines the same wrappers
# (cheap; one `eval` per command). When the commands dir is absent (e.g. on a
# machine where claude/setup.js has never run), the glob expands to its own
# pattern and we skip it.
function _sy_register_dispatchers() {
  local cmd_file base name
  for cmd_file in "$_SY_COMMANDS_DIR"/sy-*.md; do
    [ -f "$cmd_file" ] || continue
    base=$(basename "$cmd_file")
    name="${base#sy-}"
    name="${name%.md}"
    eval "function sy-${name}() { _sy_dispatch '${name}' \"\$@\"; }"
  done
}
_sy_register_dispatchers
