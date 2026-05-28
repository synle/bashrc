#!/usr/bin/env bash

################################################################################
# ---- Aliases: Claude ----
#
# Wrapper around the `claude` binary. No-ops with a message when claude is not
# installed; otherwise enables allow/dangerous skip permissions, then picks the
# strongest mode/effort the installed version supports:
#   claude >= 2.1.100 -> --permission-mode auto             --effort max
#   older builds      -> --permission-mode bypassPermissions --effort high
# (`auto` and `max`/`xhigh` only exist on >= 2.1.100; older builds accept
# `bypassPermissions` + `high` instead.)
#
# Use `claude resume` or `claude r` to open the resume picker.
# Echoes the resolved command to stderr before invoking so the user can see
# exactly which flags are passed through to the binary.
################################################################################

# claude: wrapper around the `claude` binary; echoes resolved invocation to stderr before running
function claude() {
  # `type -P` resolves only PATH binaries, so it ignores this very function and we don't recurse.
  if ! type -P claude > /dev/null 2>&1; then
    echo "claude is not installed" >&2
    return 1
  fi
  # Both `--permission-mode auto` and `--effort max`/`xhigh` landed around claude 2.1.100;
  # older builds reject them ("auto" rejected by --permission-mode, "max" by --effort).
  # Cache the decision in the shell so we don't re-spawn `claude --version` on every call
  # ("on" = new flags supported, "off" = use the older low/medium/high effort set).
  if [ -z "${_CLAUDE_PERMISSION_MODE:-}" ]; then
    local _cl_ver _cl_maj _cl_min _cl_patch
    _CLAUDE_PERMISSION_MODE="off"
    _cl_ver="$(command claude --version 2> /dev/null | awk '{print $1}')"
    if [ -n "$_cl_ver" ]; then
      IFS='.' read -r _cl_maj _cl_min _cl_patch <<< "$_cl_ver"
      _cl_patch="${_cl_patch%%[!0-9]*}"
      _cl_maj="${_cl_maj:-0}"
      _cl_min="${_cl_min:-0}"
      _cl_patch="${_cl_patch:-0}"
      if [ "$_cl_maj" -gt 2 ] \
        || { [ "$_cl_maj" -eq 2 ] && [ "$_cl_min" -gt 1 ]; } \
        || { [ "$_cl_maj" -eq 2 ] && [ "$_cl_min" -eq 1 ] && [ "$_cl_patch" -ge 100 ]; }; then
        _CLAUDE_PERMISSION_MODE="on"
      fi
    fi
  fi
  # `command claude` bypasses this function so the call hits the real binary, not us.
  local -a _cl_cmd
  _cl_cmd=(command claude --allow-dangerously-skip-permissions --dangerously-skip-permissions)
  if [ "$_CLAUDE_PERMISSION_MODE" = "on" ]; then
    _cl_cmd+=(--permission-mode auto --effort max)
  else
    _cl_cmd+=(--permission-mode bypassPermissions --effort high)
  fi
  if [ "${1:-}" = "resume" ] || [ "${1:-}" = "r" ]; then
    shift
    _cl_cmd+=(--resume)
  fi
  # Echo the resolved invocation to stderr so the user can see all flags being
  # passed through (stderr keeps it out of `claude --print ... | jq` pipelines).
  echo "${_cl_cmd[@]}" "$@" >&2
  "${_cl_cmd[@]}" "$@"
}
alias cl='claude'
alias cm='claude --model claude-opus-4-7[1m]'

# claude_edit_config: open ~/.claude.json (Claude Code top-level config) in the editor
function claude_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "claude_edit_config: open ~/.claude.json in the editor via view_file
  Usage: claude_edit_config

~/.claude.json is Claude Code's top-level state file (recent project paths,
MCP server registrations, OAuth token state, per-project settings). This is the
file most users actually want to edit when tweaking Claude Code.

Related files NOT opened here:
  ~/.claude/settings.json   - managed defaults seeded by claude/setup.js; edit
                              software/scripts/advanced/llm/claude/setup.js
                              (GLOBAL_CLAUDE_SETTINGS) if you want changes to
                              survive a re-run.
  ~/.claude/CLAUDE.md       - user-level engineering rules (sourced from
                              software/scripts/advanced/llm/_common/instructions.md).
  ~/.claude/keybindings.json - generated from
                              software/scripts/advanced/llm/claude/claude-keys.common.jsonc."
    return 0
  fi
  view_file "$HOME"
}
