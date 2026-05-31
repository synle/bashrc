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
#   ~/.gemini/GEMINI.md        - shared engineering rules (managed block keyed by source path)
################################################################################

alias gem="gemini"

# gemini_edit_config: open the ~/.gemini/ config dir (settings, keybindings, GEMINI.md) in the editor
function gemini_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "gemini_edit_config: open ~/.gemini/ in the editor via view_file
  Usage: gemini_edit_config

Opens the whole ~/.gemini/ config dir so settings.json, keybindings.json, and
GEMINI.md are all reachable in the same session.

Files inside ~/.gemini/ worth knowing about:
  ~/.gemini/settings.json    - every user-tunable Gemini CLI setting
                               (selectedAuthType, gcpProjectId, theme, model
                               overrides, mcpServers, hideBanner, hideTips,
                               etc.). Managed defaults are seeded by
                               gemini/setup.js; layer your own overrides on top.
  ~/.gemini/keybindings.json - generated from
                               software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc.
  ~/.gemini/GEMINI.md        - user-level engineering rules (sourced from
                               software/scripts/advanced/llm/_common/instructions.md)."
    return 0
  fi
  view_file "$HOME/.gemini"
}

# _gemini_list_prompts_ts: raw `<ISO-ts>\t<content>` NUL stream from Gemini CLI's session JSONs
#
# Internal helper consumed by `gemini_list_prompts` and `llm_list_prompts`.
# NOT deduped, NOT capped.
#
# Source: ~/.gemini/tmp/<project>/chats/session-*.json. Each session has a
# `messages` array; user prompts have type=user (or role=user) and a STRING
# `content`. Filenames are ISO-timestamped; reverse filename sort is a good
# coarse newest-first ordering before the dedupe-cap stage.
function _gemini_list_prompts_ts() {
  local dir="$HOME/.gemini/tmp"
  [ -d "$dir" ] || return 0
  type -P jq > /dev/null 2>&1 || return 0
  command find "$dir" -path '*/chats/session-*.json' -type f 2> /dev/null \
    | command sort -r \
    | command xargs command cat 2> /dev/null \
    | jq -c '(.messages // [])[] | select(((.type // .role) == "user") and ((.content // "") | type == "string")) | {ts: (.timestamp // ""), c: .content}' 2> /dev/null \
    | command sort -r \
    | command head -n $((_LLM_PROMPTS_LIMIT * 4)) \
    | jq -j '.ts, "\t", .c, "\u0000"' 2> /dev/null
}

# gemini_list_prompts: stream past user prompts (newest first, deduped, capped) as NUL-delimited records
function gemini_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "gemini_list_prompts: stream past Gemini CLI user prompts as NUL records
  Usage: gemini_list_prompts             # NUL-delimited stream, newest first

Records are deduplicated and capped at \$_LLM_PROMPTS_LIMIT (currently ${_LLM_PROMPTS_LIMIT:-500}).
Source: ~/.gemini/tmp/<project>/chats/session-*.json, .messages[] WHERE role/type=user."
    return 0
  fi
  _gemini_list_prompts_ts | _llm_dedupe_and_cap
}

# gemini_search_prompts: fuzzy-pick a past Gemini CLI prompt and copy it to the clipboard
function gemini_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "gemini_search_prompts: fzf picker over past Gemini CLI prompts
  Usage: gemini_search_prompts

Pipes gemini_list_prompts into a shared fzf picker. The preview pane shows
the full prompt; Enter copies the selected prompt to the system clipboard
(via the universal copy helper). Paste it back into gemini."
    return 0
  fi
  _llm_search_prompts gemini
}
