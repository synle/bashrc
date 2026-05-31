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

# claude_edit_config: open ~/.claude.json AND the ~/.claude/ config dir in the editor
function claude_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "claude_edit_config: open ~/.claude.json + ~/.claude/ in the editor via view_file
  Usage: claude_edit_config

~/.claude.json is Claude Code's top-level state file (recent project paths,
MCP server registrations, OAuth token state, per-project settings). This is the
file most users actually want to edit when tweaking Claude Code. The companion
~/.claude/ directory is opened alongside it so settings.json, CLAUDE.md,
keybindings.json, and commands/*.md are all reachable in the same session.

Files inside ~/.claude/ worth knowing about:
  ~/.claude/settings.json    - managed defaults seeded by claude/setup.js; edit
                               software/scripts/advanced/llm/claude/setup.js
                               (GLOBAL_CLAUDE_SETTINGS) if you want changes to
                               survive a re-run.
  ~/.claude/CLAUDE.md        - user-level engineering rules (sourced from
                               software/scripts/advanced/llm/_common/instructions.md).
  ~/.claude/keybindings.json - generated from
                               software/scripts/advanced/llm/claude/claude-keys.common.jsonc."
    return 0
  fi
  view_file "$HOME/.claude.json"
  view_file "$HOME/.claude"
}

# _claude_list_prompts_ts: raw `<ISO-ts>\t<content>` NUL stream from Claude Code's JSONL sessions
#
# Internal helper consumed by `claude_list_prompts` and the aggregate
# `llm_list_prompts`. NOT deduped, NOT capped — downstream `_llm_dedupe_and_cap`
# handles ordering, dedupe, and cap so the four CLIs can merge cleanly.
#
# Source: ~/.claude/projects/<encoded-cwd>/*.jsonl. Each line is a JSON
# record; user prompts have type=user with .message.role=user and a STRING
# .message.content (array content is tool_result payloads, skipped).
function _claude_list_prompts_ts() {
  local dir="$HOME/.claude/projects"
  [ -d "$dir" ] || return 0
  type -P jq > /dev/null 2>&1 || return 0
  # `sort -r` on `{"ts":"<ISO ts>"...` JSON lines is a valid newest-first
  # cut because ISO-8601 is lex-sortable. `head` keeps the working set
  # bounded before jq formats it for the dedupe-cap stage.
  command find "$dir" -name '*.jsonl' -type f -print0 2> /dev/null \
    | command xargs -0 command cat 2> /dev/null \
    | jq -c 'select(.type=="user" and (.message.content|type=="string")) | {ts: .timestamp, c: .message.content}' 2> /dev/null \
    | command sort -r \
    | command head -n $((_LLM_PROMPTS_LIMIT * 4)) \
    | jq -j '.ts, "\t", .c, "\u0000"' 2> /dev/null
}

# claude_list_prompts: stream past user prompts (newest first, deduped, capped) as NUL-delimited records
function claude_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "claude_list_prompts: stream past Claude Code user prompts as NUL records
  Usage: claude_list_prompts             # NUL-delimited stream, newest first

Records are deduplicated and capped at \$_LLM_PROMPTS_LIMIT (currently ${_LLM_PROMPTS_LIMIT:-500}).
Source: ~/.claude/projects/<encoded-cwd>/*.jsonl, filtered to user-typed text."
    return 0
  fi
  _claude_list_prompts_ts | _llm_dedupe_and_cap
}

# claude_search_prompts: fuzzy-pick a past Claude Code prompt and copy it to the clipboard
function claude_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "claude_search_prompts: fzf picker over past Claude Code prompts
  Usage: claude_search_prompts

Pipes claude_list_prompts into a shared fzf picker. The preview pane shows
the full prompt; Enter copies the selected prompt to the system clipboard
(via the universal copy helper). Paste it back into Claude Code."
    return 0
  fi
  _llm_search_prompts claude
}
