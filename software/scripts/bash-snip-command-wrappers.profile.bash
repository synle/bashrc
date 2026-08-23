#!/usr/bin/env bash
################################################################################
# --- Snip transparent command wrappers ---
#
# For every snip-supported base command below, this defines a wrapper that runs
# the command through snip's output filter ONLY when both hold:
#
#   1. stdout is a TTY (`[ -t 1 ]`) — load-bearing: snip rewrites output even when
#      piped, so without it `<cmd> | jq`, `x=$(<cmd>)`, and `<cmd> > f` would all
#      read filtered text. The guard keeps every pipeline, command-substitution,
#      and redirect byte-exact — filtering only what a human is looking at.
#   2. should_use_snip_cli succeeds — snip installed AND BYPASS_SNIP_CLI_OVERRIDE
#      not truthy. That shared helper lives in bash-snip.profile.bash so the
#      snip-installed + bypass decision is defined once, not per wrapper.
#
# Otherwise the raw binary runs untouched.
#
# --- Bypassing snip for a single command ---
# Prefix the call with the bypass flag; there is no separate `raw_<cmd>`:
#
#   BYPASS_SNIP_CLI_OVERRIDE=1 npm install     # runs the real npm, no snip
#   export BYPASS_SNIP_CLI_OVERRIDE=1          # bypass for the rest of the shell
#
# The command list is the single source of truth — add a name to
# `_SNIP_WRAP_COMMANDS` and its wrapper appears. Sourced AFTER
# bash-command-wrappers.profile.bash so the loop can see the repo's own wrappers
# and skip them: `npm`, `yarn`, `pip` (smart wrappers) and `pytest` (alias) keep
# their behavior — snip execs the binary and would drop it — so those names are
# left untouched entirely. Use `sn -f npm …` to force snip through them once.
#
# `git` is deliberately absent (never transparently wrapped — use `sn git …`), as
# are coreutils (`ls`, `grep`, `find`, …). See docs/snip.md.
################################################################################

# Single source of truth: snip-supported base commands to wrap, grouped by
# ecosystem. Only real PATH binaries belong here — `spring-boot` (a build-plugin,
# not a binary) and `gradlew` (a project-local script) are intentionally absent.
_SNIP_WRAP_COMMANDS=(
  # --- JS / TS ---
  npm npx pnpm yarn nx turbo tsc eslint oxlint biome prettier
  jest vitest playwright next prisma trunk
  # --- Python ---
  pip poetry uv pytest ruff mypy basedpyright ty
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

# Define the wrappers dynamically. Skip any name already owned by a function or
# alias so the repo's own wrappers (npm, yarn, pip, pytest, …) are never clobbered.
for _cmd in "${_SNIP_WRAP_COMMANDS[@]}"; do
  case "$(type -t "$_cmd" 2> /dev/null)" in
  function | alias) continue ;;
  esac

  eval "function ${_cmd}() {
    if [ -t 1 ] && should_use_snip_cli; then
      snip -- ${_cmd} \"\$@\"
    else
      command ${_cmd} \"\$@\"
    fi
  }"
done
unset _cmd

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
