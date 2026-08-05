#!/usr/bin/env bash

# _claude_endpoint_speaks_anthropic: probe whether a base URL implements the Anthropic Messages API
#
# Claude Code only speaks the Anthropic Messages API (`POST /v1/messages`). Ollama
# serves its own `/api/*` routes plus an OpenAI-compatible `/v1/chat/completions`,
# and has no `/v1/messages` — pointing ANTHROPIC_BASE_URL straight at port 11434
# fails on the first turn. Probing here turns that into one clear message instead
# of an opaque API error inside the TUI.
#
# Returns 0 when the endpoint answers /v1/messages with anything other than a
# routing miss (400/401/422 all mean "route exists, request was rejected"), 1 when
# the route is absent (404/405) or the host never answered.
function _claude_endpoint_speaks_anthropic() {
  local host="$1"
  local code
  code="$(command curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    -X POST "$host/v1/messages" \
    -H 'content-type: application/json' \
    -H 'anthropic-version: 2023-06-01' \
    -d '{}' 2> /dev/null)"
  case "$code" in
    000 | 404 | 405) return 1 ;;
    *) return 0 ;;
  esac
}

# claude_with_ip_address: run `claude` against a self-hosted Anthropic-compatible endpoint
#
# Host and model both default to the sy-omen45l workstation values exported by
# ollama.profile.bash ($SY_OMEN45L_IP / $SY_OMEN45L_OLLAMA_PORT /
# $SY_OMEN45L_OLLAMA_DEFAULT_MODEL). $SY_OMEN45L_IP is resolved at profile-load
# time from software/metadata/ip-address.config, so no address is hardcoded here.
# Falls back to 127.0.0.1 when that lookup produced nothing.
# Supports an `ls` subcommand that lists a host's Ollama models via list_ollama_models.
function claude_with_ip_address() {
  if is_help_arg "${1:-}"; then
    echo "claude_with_ip_address: run \`claude\` against a self-hosted Anthropic-compatible endpoint
  Usage: claude_with_ip_address [host[:port]] [model]
         claude_with_ip_address ls [host[:port]]

Host defaults to \$SY_OMEN45L_IP:\$SY_OMEN45L_OLLAMA_PORT (falling back to
127.0.0.1:11434); model defaults to \$SY_OMEN45L_OLLAMA_DEFAULT_MODEL. Those
vars are exported by ollama.profile.bash, which resolves the IP from
software/metadata/ip-address.config — edit that file to change the address.

A bare hostname/IP is normalized to http://<host>:<port>; an explicit scheme
or port is preserved as given. The resolved command is echoed before it runs.

IMPORTANT: the endpoint must implement the Anthropic Messages API
(POST /v1/messages). A bare Ollama daemon does NOT — it serves /api/* and an
OpenAI-compatible /v1/chat/completions, so it is rejected here with
instructions rather than failing mid-session. To drive local models with
Claude Code, put a translating gateway in front of Ollama and point this at
the gateway's port; opencode (\`op\`) talks to Ollama natively and needs no
gateway at all.

Set SY_CLAUDE_LOCAL_FORCE=1 to skip the probe and launch anyway."
    return 0
  fi

  local default_model="${SY_OMEN45L_OLLAMA_DEFAULT_MODEL:-gemma4:26b}"

  # Handle 'ls' or list command
  if [[ "$1" == "ls" ]]; then
    list_ollama_models "${2:-}"
    return 0
  fi

  # _ollama_url (ollama.profile.bash) owns host normalization for every local-LLM
  # consumer, so the scheme/port rules stay declared in exactly one place.
  local host
  host="$(_ollama_url "${1:-}")"
  local model="${2:-$default_model}"

  if [ "${SY_CLAUDE_LOCAL_FORCE:-0}" != "1" ] && ! _claude_endpoint_speaks_anthropic "$host"; then
    echo "claude_with_ip_address: $host does not serve the Anthropic Messages API (POST /v1/messages)." >&2
    if command curl -fsS --max-time 5 "$host/api/tags" > /dev/null 2>&1; then
      echo "  That host is a plain Ollama daemon. Claude Code cannot talk to it directly." >&2
      echo "  Options:" >&2
      echo "    1. opencode  — already configured against this host: run 'op'" >&2
      echo "    2. gateway   — run an Anthropic-format gateway in front of Ollama, then" >&2
      echo "                   claude_with_ip_address <gateway-host>:<port> <model>" >&2
      echo "  See docs/claude_local_readme.md for the gateway setup." >&2
    else
      echo "  Host did not answer. Check it with: ollama_doctor $host" >&2
    fi
    echo "  Set SY_CLAUDE_LOCAL_FORCE=1 to bypass this check." >&2
    return 1
  fi

  # ANTHROPIC_AUTH_TOKEN (not ANTHROPIC_API_KEY) is what makes Claude Code stop using
  # the saved claude.ai subscription credential for this session; a self-hosted gateway
  # ignores the value but the variable has to be present. API_TIMEOUT_MS is raised well
  # past the 60s-class default because a local model can spend minutes on prompt eval
  # plus generation, and the client giving up first is indistinguishable from a hang.
  # CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC keeps background calls off a single-slot
  # local daemon so they can't queue ahead of the turn you are waiting on.
  echo -e ANTHROPIC_BASE_URL="$host" claude --model "$model\n\n"
  ANTHROPIC_BASE_URL="$host" \
    ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-local}" \
    ANTHROPIC_SMALL_FAST_MODEL="${ANTHROPIC_SMALL_FAST_MODEL:-$model}" \
    ANTHROPIC_DEFAULT_HAIKU_MODEL="${ANTHROPIC_DEFAULT_HAIKU_MODEL:-$model}" \
    API_TIMEOUT_MS="${API_TIMEOUT_MS:-1200000}" \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    claude --model "$model"
}

################################################################################
# --- Aliases: Claude ---
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
  if ! type -P claude > /dev/null 2>&1; then
    echo "claude is not installed" >&2
    return 1
  fi

  # Activate node once per shell session (no-op on later calls).
  if ! llm_setup_activate; then
    echo "node activation failed: llm_setup_activate/activate_node is missing" >&2
    return 1
  fi

  # properly clean up and hook up for the ollama
  if [[ "${ANTHROPIC_BASE_URL:-}" == http* ]]; then
    unset ANTHROPIC_API_KEY
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

# `cl` runs claude against the sy-omen45l Ollama box. Both the host and the model come
# from claude_with_ip_address's own defaults ($SY_OMEN45L_IP / $SY_OMEN45L_OLLAMA_PORT /
# $SY_OMEN45L_OLLAMA_DEFAULT_MODEL, exported by ollama.profile.bash) so the address stays
# declared only in software/metadata/ip-address.config.
alias cl='claude_with_ip_address'

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
  # The jq filter drops Claude Code's synthetic wrapper messages that look
  # like user prompts on disk but were injected by the framework, not typed
  # by Sy: slash-command machinery (`<command-name>`, `<command-message>`,
  # `<command-args>`, `<local-command-caveat>`, `<local-command-stdout>`),
  # Task-tool output (`<task-notification>`, `<task-id>`, `<tool-use-id>`,
  # `<summary>`, `<status>`, `<output-file>`, `<result>`, `<usage>`,
  # `<host>`, `<worktree>`). Low-frequency tags like `<svg>` / `<stem>` are
  # real user pastes and are KEPT.
  command find "$dir" -name '*.jsonl' -type f -print0 2> /dev/null \
    | command xargs -0 command cat 2> /dev/null \
    | jq -c 'select(.type=="user" and (.message.content|type=="string") and ((.message.content | test("^<(command-(name|message|args)|local-command-(caveat|stdout)|task-(notification|id)|tool-use-id|summary|status|output-file|result|usage|host|worktree)[> ]")) | not)) | {ts: .timestamp, c: .message.content}' 2> /dev/null \
    | command sort -r \
    | command head -n $((_LLM_PROMPTS_LIMIT * 4)) \
    | jq -j '.ts, "\t", .c, "\u0000"' 2> /dev/null
}

# claude_list_prompts: stream past user prompts (newest first, deduped, capped) — cache-backed
function claude_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "claude_list_prompts: stream past Claude Code user prompts as NUL records
  Usage: claude_list_prompts             # NUL-delimited stream, newest first

Cache-backed: reads from \$_LLM_PROMPTS_CACHE_DB. Cold cache triggers a
one-shot foreground refresh from ~/.claude/projects/<encoded-cwd>/*.jsonl.
Records are deduplicated and capped at \$_LLM_PROMPTS_LIMIT (currently ${_LLM_PROMPTS_LIMIT:-500})."
    return 0
  fi
  _llm_list_prompts_cached claude
}

# claude_search_prompts: fuzzy-pick a past Claude Code prompt and copy it to the clipboard
function claude_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "claude_search_prompts: fzf picker over past Claude Code prompts
  Usage: claude_search_prompts

Pipes claude_list_prompts into a shared fzf picker. The preview pane shows
a '# prompted in <vendor> on <local timestamp>' header followed by the full
prompt; Enter copies the selected prompt (header excluded) to the system
clipboard (via the universal copy helper). Paste it back into Claude Code."
    return 0
  fi
  _llm_search_prompts claude
}
