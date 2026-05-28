# opencode: wrapper around the `opencode` binary
# SOURCE | software/bootstrap/common-functions.bash
function opencode() {
  if ! command -v opencode > /dev/null 2>&1; then
    echo "opencode is not installed" >&2
    return 1
  fi
  command opencode "$@"
}

alias op='opencode'

# opencode_edit_config: open ~/.config/opencode/opencode.json (OpenCode user config) in the editor
function opencode_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "opencode_edit_config: open ~/.config/opencode/opencode.json in the editor via view_file
  Usage: opencode_edit_config

~/.config/opencode/opencode.json is OpenCode's user config (\$schema:
https://opencode.ai/config.json). Holds provider/model definitions
(remote + local Ollama), formatter rules, MCP servers, and any user
overrides. Managed defaults are seeded by opencode/setup.js.

Related files NOT opened here:
  ~/.config/opencode/tui.json       - keybindings + TUI state; generated from
                                      software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc.
  ~/.config/opencode/commands/*.md  - slash command definitions, symlinked
                                      from ~/.claude/commands/ by opencode/setup.js.
  ~/.local/share/opencode/opencode.db - SQLite store for sessions/history."
    return 0
  fi
  view_file "$HOME/.config/opencode"
}
