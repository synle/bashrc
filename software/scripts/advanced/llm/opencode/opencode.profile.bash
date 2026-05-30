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
