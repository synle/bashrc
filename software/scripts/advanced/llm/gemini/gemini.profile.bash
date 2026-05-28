#!/usr/bin/env bash

################################################################################
# ---- Aliases: Gemini ----
#
# Lightweight wrapper layer for Google Gemini CLI. No `gemini` wrapper function
# (unlike claude / copilot / opencode) — the binary's defaults are already
# acceptable and there are no autonomous-mode flags worth pre-binding.
#
# User-level config managed by software/scripts/advanced/llm/gemini/setup.js:
#   ~/.gemini/settings.json    - hideBanner, hideTips, etc. (defaults-merge)
#   ~/.gemini/keybindings.json - from gemini-keys.common.jsonc (additive merge)
#   ~/.gemini/GEMINI.md        - shared engineering rules (managed-rules block)
################################################################################

alias gem="gemini"

# gemini_edit_config: open ~/.gemini/settings.json (Gemini CLI user settings) in the editor
function gemini_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "gemini_edit_config: open ~/.gemini/settings.json in the editor via view_file
  Usage: gemini_edit_config

~/.gemini/settings.json holds every user-tunable Gemini CLI setting
(selectedAuthType, gcpProjectId, theme, model overrides, mcpServers,
hideBanner, hideTips, etc.). Managed defaults are seeded by gemini/setup.js;
this opens the live file so the user can layer their own overrides.

Related files NOT opened here:
  ~/.gemini/keybindings.json - generated from
                              software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc.
  ~/.gemini/GEMINI.md        - user-level engineering rules (sourced from
                              software/scripts/advanced/llm/_common/instructions.md)."
    return 0
  fi
  view_file "$HOME/.gemini"
}
