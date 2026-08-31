#!/usr/bin/env bash
################################################################################
# --- Snip transparent command wrappers ---
#
# For every snip-supported base command below, this defines a wrapper that first
# verifies the real binary exists (clear error if not), then runs the command
# through snip's output filter ONLY when both hold:
#
#   1. stdout is a TTY (`[ -t 1 ]`) — load-bearing: snip rewrites output even when
#      piped, so without it `<cmd> | jq`, `x=$(<cmd>)`, and `<cmd> > f` would all
#      read filtered text. The guard keeps every pipeline, command-substitution,
#      and redirect byte-exact — filtering only what a human is looking at.
#   2. should_use_snip_cli succeeds — snip installed AND BYPASS_SNIP_CLI_OVERRIDE
#      not truthy. That shared helper lives in bash-snip.profile.bash so the
#      snip-installed + bypass decision is defined once, not per wrapper.
#
# Otherwise the raw binary runs untouched. The binary-exists check
# (_snip_require_binary) runs FIRST, before either path, so a tool that is not
# installed reports itself plainly instead of as a snip passthrough oddity.
#
# --- Bypassing snip for a single command ---
# Prefix the call with the bypass flag; there is no separate `raw_<cmd>`:
#
#   BYPASS_SNIP_CLI_OVERRIDE=1 npm install     # runs the real npm, no snip
#   export BYPASS_SNIP_CLI_OVERRIDE=1          # bypass for the rest of the shell
#
# The command list is the single source of truth — add a name to
# `_SNIP_WRAP_COMMANDS` and its wrapper appears. `npm`, `yarn`, `pip` are NOT in
# it: they have hand-rolled smart wrappers in bash-command-wrappers.profile.bash
# that special-case their arguments, so those wrappers route their own final exec
# through the shared _snip_run helper instead. The loop still skips any other name
# already owned by a function or alias (e.g. the `pytest` alias) as a safety net.
#
# `git` is deliberately absent (never transparently wrapped — use `sn git …`), as
# are coreutils (`ls`, `grep`, `find`, …). See docs/snip.md.
################################################################################

# Single source of truth: snip-supported base commands to wrap, grouped by
# ecosystem. Only real PATH binaries belong here — `spring-boot` (a build-plugin,
# not a binary) and `gradlew` (a project-local script) are intentionally absent.
_SNIP_WRAP_COMMANDS=(
  # --- JS / TS ---
  npx pnpm nx turbo tsc eslint oxlint biome prettier
  jest vitest playwright next prisma trunk
  # --- Python ---
  poetry uv pytest ruff mypy basedpyright ty
  # --- Rust ---
  cargo rustc
  # --- Go ---
  go golangci-lint
  # --- JVM ---
  mvn gradle liquibase
  # --- .NET ---
  dotnet
  # --- Ruby ---
  bundle rails rake rspec rubocop
  # --- Elixir ---
  mix
  # --- C / native / build ---
  gcc g++ swift xcodebuild pio quarto composer make just task mise
  # --- Linters / formatters ---
  markdownlint markdownlint-cli2 yamllint shellcheck pre-commit hadolint
  # --- Containers / cloud / infra (Tier 2, minus git) ---
  docker docker-compose kubectl helm skopeo
  terraform tofu ansible-playbook aws gcloud sops
  # --- VCS-ish / misc (Tier 2, minus git) ---
  gh jj gt yadm jira shopify ollama brew
)

# _snip_require_binary <cmd>: fail with a clear message when <cmd>'s real binary
# is not on PATH. `type -P` forces a PATH lookup (skipping this very function), so
# it answers "is the actual program installed" rather than "is there a wrapper".
# This is the safety net that runs FIRST in every wrapper, before any snip/raw
# dispatch — so a missing tool reports itself plainly instead of surfacing as a
# confusing snip passthrough error or a bare "command not found".
function _snip_require_binary() {
  if ! type -P "$1" > /dev/null 2>&1; then
    echo "$1: command not found — '$1' is not installed or not on your PATH" >&2
    return 127
  fi
}

# _register_snip_wrappers: define the transparent wrappers for every command in
# _SNIP_WRAP_COMMANDS. `npm`, `yarn`, `pip` are intentionally absent from the
# list above — they have hand-rolled smart wrappers in
# bash-command-wrappers.profile.bash that special-case their args and route the
# final exec through _snip_run themselves. The skip below is a safety net for any
# OTHER name already owned by a function or alias (e.g. the `pytest` alias), so a
# future collision is never clobbered.
#
# Not called here: the dynamic-alias cache partial (sourced last) invokes it once
# behind a `type -P snip` guard and caches the generated wrappers. The names it
# actually defines are recorded in _SNIP_WRAPPED_NAMES so the cache dump can find
# them (they are not tracked in _COMMAND_VARIANTS).
function _register_snip_wrappers() {
  _SNIP_WRAPPED_NAMES=""
  local _cmd
  for _cmd in "${_SNIP_WRAP_COMMANDS[@]}"; do
    case "$(type -t "$_cmd" 2> /dev/null)" in
    function | alias) continue ;;
    esac

    eval "function ${_cmd}() {
      _snip_require_binary ${_cmd} || return 127
      _snip_run ${_cmd} \"\$@\"
    }"
    _SNIP_WRAPPED_NAMES="${_SNIP_WRAPPED_NAMES}${_cmd} "
  done
}

# snip_wrap_status: show which snip command wrappers are active vs skipped
function snip_wrap_status() {
  if is_help_arg "${1:-}"; then
    echo "snip_wrap_status: list the snip command wrappers and their state
  Usage: snip_wrap_status
  For each command in \$_SNIP_WRAP_COMMANDS prints one of:
    snip     bare <cmd> filters through snip at a TTY; bypass a single call with
             'BYPASS_SNIP_CLI_OVERRIDE=1 <cmd> …'
    skipped  another wrapper owns <cmd> (npm, yarn, pip, pytest, …) — left alone;
             use 'sn -f <cmd>' to force snip once
  Filtering never happens off a TTY (pipes, \$(...), redirects stay raw), when
  BYPASS_SNIP_CLI_OVERRIDE is truthy, or when snip is not installed."
    return 0
  fi

  local c state body
  for c in "${_SNIP_WRAP_COMMANDS[@]}"; do
    body="$(type "$c" 2> /dev/null)"
    if printf '%s' "$body" | grep -q 'snip --'; then
      state="snip"
    else
      state="skipped (owned by another wrapper)"
    fi
    printf '  %-20s %s\n' "$c" "$state"
  done
}
