# opencode: wrapper around the `opencode` binary.
#
# Ergonomic shortcut: when called with exactly one argument that resolves to a
# readable file, rewrite to `opencode --prompt "$(cat <file>)"` so the file
# contents are sent as the initial prompt instead of opencode treating the
# path as a positional `project` arg. All other invocations passthrough.
# SOURCE | software/bootstrap/common-functions.bash
function opencode() {
  if ! type -P opencode > /dev/null 2>&1; then
    echo "opencode is not installed" >&2
    return 1
  fi

  # Single-arg + arg is a readable file -> pipe contents in as the prompt.
  if [ "$#" -eq 1 ] && [ -f "$1" ] && [ -r "$1" ]; then
    command opencode --prompt "$(command cat "$1")"
    return
  fi

  command opencode "$@"
}

alias op='opencode'

# opencode_edit_config: open the ~/.config/opencode/ config dir (opencode.json, tui.json, AGENTS.md, commands/) in the editor
function opencode_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "opencode_edit_config: open ~/.config/opencode/ in the editor via view_file
  Usage: opencode_edit_config

Opens the whole ~/.config/opencode/ config dir so opencode.json, tui.json,
AGENTS.md, and commands/ are all reachable in the same session.

Files inside ~/.config/opencode/ worth knowing about:
  opencode.json    - provider/model definitions (remote + local Ollama +
                     github-copilot), permission allow-list, compaction,
                     tool_output truncation. \$schema:
                     https://opencode.ai/config.json. Managed defaults are
                     seeded by opencode/setup.js.
  tui.json         - keybindings + TUI behavior (mouse capture, scroll speed,
                     attention/notifications). Generated from
                     software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc
                     and the inline TUI defaults in opencode/setup.js.
  AGENTS.md        - user-level engineering rules (sourced from
                     software/scripts/advanced/llm/_common/instructions.md).
  commands/*.md    - slash command definitions, symlinked from
                     ~/.claude/commands/ by opencode/setup.js.

Related file NOT inside the dir:
  ~/.local/share/opencode/opencode.db - SQLite store for sessions/history."
    return 0
  fi
  view_file "$HOME/.config/opencode"
}

# _opencode_list_prompts_ts: raw `<ISO-ts>\t<content>` NUL stream from opencode's SQLite store
#
# Internal helper consumed by `opencode_list_prompts` (single-CLI public
# surface) and `llm_list_prompts` (aggregate). NOT deduped, NOT capped —
# `_llm_dedupe_and_cap` does that downstream so the aggregate can merge
# raw streams from four CLIs into one global newest-first cut.
#
# Source: ~/.local/share/opencode/opencode.db. User messages are rows in
# `message` with role=user; their text content lives in `part` rows of
# type=text linked by message_id. `m.time_created` is epoch-ms; divide by
# 1000 and feed to jq's `todate` to get an ISO-8601 string.
function _opencode_list_prompts_ts() {
  local db="$HOME/.local/share/opencode/opencode.db"
  [ -f "$db" ] || return 0
  type -P sqlite3 > /dev/null 2>&1 || return 0
  type -P jq > /dev/null 2>&1 || return 0
  sqlite3 -json "$db" "SELECT json_extract(p.data,'\$.text') AS c, (m.time_created/1000) AS ts_s FROM message m JOIN part p ON p.message_id=m.id WHERE json_extract(m.data,'\$.role')='user' AND json_extract(p.data,'\$.type')='text' ORDER BY m.time_created DESC LIMIT $((_LLM_PROMPTS_LIMIT * 2));" 2> /dev/null \
    | jq -j '.[] | select(.c != null and .c != "") | (.ts_s|todate), "\t", .c, "\u0000"' 2> /dev/null
}

# opencode_list_prompts: stream past user prompts (newest first, deduped, capped) — cache-backed
function opencode_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "opencode_list_prompts: stream past user prompts from opencode's SQLite store
  Usage: opencode_list_prompts            # NUL-delimited stream, newest first

Cache-backed: reads from \$_LLM_PROMPTS_CACHE_DB. Cold cache triggers a
one-shot foreground refresh from ~/.local/share/opencode/opencode.db.
Records are deduplicated and capped at \$_LLM_PROMPTS_LIMIT (currently ${_LLM_PROMPTS_LIMIT:-500})."
    return 0
  fi
  _llm_list_prompts_cached opencode
}

# opencode_search_prompts: fuzzy-pick a past opencode prompt and copy it to the clipboard
function opencode_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "opencode_search_prompts: fzf picker over past opencode prompts
  Usage: opencode_search_prompts

Pipes opencode_list_prompts into a shared fzf picker. The preview pane shows
the full prompt; Enter copies the selected prompt to the system clipboard
(via the universal copy helper). Paste it back into opencode with Cmd/Ctrl+V."
    return 0
  fi
  _llm_search_prompts opencode
}
