# pi: wrapper around the `pi` minimal agent-harness binary (https://pi.dev).
#
# Ergonomic shortcut: when called with exactly one argument that resolves to a
# readable file, rewrite to `pi @<file>` so the file contents are attached as
# the initial message instead of pi treating the path as a bare positional
# message. All other invocations passthrough.
# SOURCE | software/bootstrap/common-functions.bash
function pi() {
  if ! type -P pi > /dev/null 2>&1; then
    echo "pi is not installed" >&2
    return 1
  fi

  # Activate node once per shell session (no-op on later calls).
  if ! llm_setup_activate; then
    echo "node activation failed: llm_setup_activate/activate_node is missing" >&2
    return 1
  fi

  # Single-arg + arg is a readable file -> attach it as the initial message.
  if [ "$#" -eq 1 ] && [ -f "$1" ] && [ -r "$1" ]; then
    command pi "@$1"
    return
  fi

  command pi "$@"
}

# pi_edit_config: open the ~/.pi/agent/ config dir (settings.json, models.json, AGENTS.md) in the editor
function pi_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "pi_edit_config: open ~/.pi/agent/ in the editor via view_file
  Usage: pi_edit_config

Opens the whole ~/.pi/agent/ config dir so settings.json, models.json, and
AGENTS.md are all reachable in the same session.

Files inside ~/.pi/agent/ worth knowing about:
  settings.json   - global settings: defaultProvider/defaultModel, theme,
                    compaction, skills/prompts/extensions resource paths.
                    Managed defaults (github-copilot provider) are seeded by
                    pi/setup.js. Schema: https://pi.dev/docs.
  models.json     - custom provider/model definitions (local Ollama hosts,
                    discovered and merged in by pi/setup.js). GitHub Copilot is
                    a built-in subscription provider reached via /login, not a
                    models.json entry.
  AGENTS.md       - user-level engineering rules (sourced from
                    software/scripts/advanced/llm/_common/instructions.md).
  auth.json       - provider credential store (OAuth tokens from /login),
                    0600. Not opened here.

Shared /sy-* skills are not stored under ~/.pi/agent/: they live once at
\$LLM_ROOT_FOLDER/skills and are symlinked into ~/.agents/skills, which pi
scans by default and exposes as /skill:<name> commands."
    return 0
  fi
  view_file "$HOME/.pi/agent"
}
