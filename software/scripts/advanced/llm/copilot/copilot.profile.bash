#!/usr/bin/env bash

################################################################################
# ---- Aliases: GitHub Copilot ----
#
# Wrapper around the `copilot` binary from the official GitHub Copilot CLI
# (installed via `curl -fsSL https://gh.io/copilot-install | bash` on mac /
# Linux / WSL, and via `winget install GitHub.Copilot` on Windows-native — see
# software/scripts/advanced/llm/copilot/install.sh and the GitHub.Copilot entry
# in software/scripts/windows/_winget-install.sh). The legacy
# `@githubnext/github-copilot-cli` package (which provided `github-copilot-cli`
# / `??`, `gh?`, `git?`) was deprecated upstream and removed from this repo.
#
# Adds `--autopilot --allow-all` for autonomous mode: grants the agent
# permission to read/write files, execute shell commands and access the network
# without prompting per-action. `--allow-all` is the documented umbrella flag
# (equivalent to --allow-all-tools --allow-all-paths --allow-all-urls per
# `copilot --help`), so no separate env vars are needed.
#
# Two layers of repo-managed config flow into Copilot:
#   1. Per-repo (handled below): the `copilot` function auto-symlinks
#      `.github/copilot-instructions.md` → `../CLAUDE.md` so per-project
#      Claude rules become per-project Copilot rules without a separately-
#      maintained instructions file.
#   2. User-level (handled by software/scripts/advanced/llm/copilot/setup.js):
#      seeds defaults into `~/.copilot/settings.json` and deploys the shared
#      engineering principles into `~/.copilot/AGENTS.md` between BEGIN/END
#      markers keyed by the source-of-truth path
#      (`synle/bashrc | software/scripts/advanced/llm/_common/instructions.md`),
#      mirroring `~/.claude/CLAUDE.md` and `~/.gemini/GEMINI.md`. Source of
#      truth: `software/scripts/advanced/llm/_common/instructions.md`.
#
# Use `co` (or `copilot`) to launch, then type natural-language requests.
# Use `co auth` to authenticate with GitHub first.
################################################################################

# copilot: wrapper around the `copilot` binary; echoes resolved invocation to stderr before running
function copilot() {
  # `type -P` resolves only PATH binaries, so it ignores this very function and we don't recurse.
  if ! type -P copilot > /dev/null 2>&1; then
    echo "copilot is not installed" >&2
    return 1
  fi
  # Auto-link .github/copilot-instructions.md → ../CLAUDE.md so Copilot CLI
  # picks up the same repo guidance as Claude Code without a separately
  # maintained instructions file. Only acts when the repo already has a
  # .github/ folder and a CLAUDE.md but no copilot-instructions.md (file or
  # symlink) yet; otherwise stays silent.
  if [ -d ".github" ] && [ ! -e ".github/copilot-instructions.md" ] && [ ! -L ".github/copilot-instructions.md" ] && [ -f "CLAUDE.md" ]; then
    command ln -s ../CLAUDE.md .github/copilot-instructions.md
    echo ">> Linked .github/copilot-instructions.md → ../CLAUDE.md" >&2
  fi
  # Echo the resolved invocation to stderr so the user can see all flags being
  # passed through (stderr keeps it out of any `copilot ... | jq` style pipelines).
  echo "command copilot --autopilot --allow-all $*" >&2
  # `command copilot` bypasses this function so the call hits the real binary, not us.
  command copilot --autopilot --allow-all "$@"
}
alias co='copilot'

# copilot_edit_config: open the ~/.copilot/ config dir (settings, AGENTS.md, mcp-config) in the editor
function copilot_edit_config() {
  if is_help_arg "${1:-}"; then
    echo "copilot_edit_config: open ~/.copilot/ in the editor via view_file
  Usage: copilot_edit_config

Opens the whole ~/.copilot/ config dir so settings.json, AGENTS.md, and
mcp-config.json are all reachable in the same session.

Files inside ~/.copilot/ worth knowing about:
  ~/.copilot/settings.json   - every user-tunable Copilot CLI setting that
                               'copilot help config' exposes (model, theme,
                               banner, hooks, enabledPlugins,
                               extraKnownMarketplaces, etc.). Managed defaults
                               are seeded by copilot/setup.js; layer your own
                               overrides on top.
  ~/.copilot/config.json     - state/credential file (auth tokens, session
                               metadata); managed by the copilot binary.
  ~/.copilot/AGENTS.md       - user-level engineering rules (sourced from
                               software/scripts/advanced/llm/_common/instructions.md).
  ~/.copilot/mcp-config.json - MCP server registrations; managed by user or by
                               the Captain install-plugin-to-copilot skill.

Note: Copilot has no keymap config in v1.0.48 — in-app chords are hardcoded
in the binary. Wrapper-layer parity lives here in copilot.profile.bash."
    return 0
  fi
  view_file "$HOME/.copilot"
}

# copilot_list_prompts: stream past user prompts (newest first, deduped, capped) as NUL-delimited records
#
# Source: ~/.copilot/session-store.db (SQLite). The `turns` table holds
# (session_id, turn_index, user_message, assistant_response, timestamp).
# Note: in copilot v1.0.48 this table is frequently empty on disk because the
# binary streams conversation state through other channels — when there's
# nothing persisted, this lister simply emits nothing (no error).
function copilot_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "copilot_list_prompts: stream past Copilot CLI user prompts as NUL records
  Usage: copilot_list_prompts            # NUL-delimited stream, newest first

Records are deduplicated and capped at \$_LLM_PROMPTS_LIMIT (currently ${_LLM_PROMPTS_LIMIT:-500}).
Source: ~/.copilot/session-store.db, table 'turns', column user_message.

Note: Copilot CLI v1.0.48 frequently leaves 'turns' empty — when that's the
case this command produces no output (and copilot_search_prompts will say
'No copilot prompts found')."
    return 0
  fi
  local db="$HOME/.copilot/session-store.db"
  [ -f "$db" ] || return 0
  type -P sqlite3 > /dev/null 2>&1 || return 0
  type -P jq > /dev/null 2>&1 || return 0
  sqlite3 -json "$db" "SELECT user_message AS c, timestamp AS ts FROM turns WHERE user_message IS NOT NULL AND user_message != '' ORDER BY timestamp DESC LIMIT $((_LLM_PROMPTS_LIMIT * 2));" 2> /dev/null \
    | jq -j '.[] | select(.c != null and .c != "") | .c, "\u0000"' 2> /dev/null \
    | _llm_dedupe_and_cap
}

# copilot_search_prompts: fuzzy-pick a past Copilot CLI prompt and copy it to the clipboard
function copilot_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "copilot_search_prompts: fzf picker over past Copilot CLI prompts
  Usage: copilot_search_prompts

Pipes copilot_list_prompts into a shared fzf picker. The preview pane shows
the full prompt; Enter copies the selected prompt to the system clipboard
(via the universal copy helper). Paste it back into copilot.

Note: if Copilot CLI hasn't persisted any prompts on this machine, this
picker will report 'No copilot prompts found' and exit cleanly."
    return 0
  fi
  _llm_search_prompts copilot
}
