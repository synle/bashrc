#!/usr/bin/env bash
################################################################################
# --- Snip transparent command wrappers ---
#
# For every snip-supported base command below, this defines two functions:
#
#   <cmd>       Runs the command through snip's output filter ONLY when stdout is
#               a TTY and snip is installed; otherwise runs the raw binary. The
#               `[ -t 1 ]` guard is load-bearing: snip rewrites output even when
#               piped, so without it `<cmd> | jq`, `x=$(<cmd>)`, and `<cmd> > f`
#               would all read filtered text. The guard keeps every pipeline,
#               command-substitution, and redirect byte-exact — filtering only
#               the interactive case a human is actually looking at.
#
#   raw_<cmd>   Always the unfiltered binary (`command <cmd>`), never snip. The
#               escape hatch for when snip misfilters a command or you need the
#               real bytes at an interactive prompt.
#
# The command list is the single source of truth — add a name to
# `_SNIP_WRAP_COMMANDS` and both wrappers appear. Sourced AFTER
# bash-command-wrappers.profile.bash so the loop can see the repo's own wrappers
# and skip them: `npm`, `yarn`, `pip` (smart wrappers) and `pytest` (alias) keep
# their behavior — snip execs the binary and would drop it — so only their bare
# name is skipped; they still get `raw_<cmd>`, and `sn -f npm …` forces snip once.
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

# Define the wrappers dynamically. `raw_<cmd>` is always created; the bare `<cmd>`
# wrapper is skipped when something already owns that name (a function or alias),
# so the repo's own wrappers are never clobbered.
for _cmd in "${_SNIP_WRAP_COMMANDS[@]}"; do
  eval "function raw_${_cmd}() { command ${_cmd} \"\$@\"; }"

  case "$(type -t "$_cmd" 2> /dev/null)" in
  function | alias) continue ;;
  esac

  eval "function ${_cmd}() {
		if [ -t 1 ] && type -P snip &> /dev/null; then
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
    snip     bare <cmd> filters through snip at a TTY; raw_<cmd> bypasses it
    skipped  another wrapper owns <cmd> (npm, yarn, pip, pytest, …) — only
             raw_<cmd> was added; use 'sn -f <cmd>' to force snip once
  Filtering never happens off a TTY (pipes, \$(...), redirects stay raw), and
  never when snip is not installed."
    return 0
  fi

  local c state body
  for c in "${_SNIP_WRAP_COMMANDS[@]}"; do
    body="$(type "$c" 2> /dev/null)"
    if printf '%s' "$body" | grep -q 'snip --'; then
      state="snip"
    else
      state="skipped (raw_${c} only)"
    fi
    printf '  %-20s %s\n' "$c" "$state"
  done
}
