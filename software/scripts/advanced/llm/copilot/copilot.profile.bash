#!/usr/bin/env bash

# ---- Aliases: GitHub Copilot ----
#
# Wrapper around `github-copilot-cli` with `--allow-all` for autonomous mode.
# The `--allow-all` flag grants the CLI agent permission to read/write files,
# execute shell commands, and access the network without prompting per-action.
#
# Use `co` (or `copilot`) to launch, then type natural-language requests.
# Use `co auth` to authenticate with GitHub first.

# copilot: wrapper around the `github-copilot-cli` binary
function copilot() {
  local cmd=""

  if type -P copilot > /dev/null 2>&1; then
    cmd="copilot"
  # this is deprecrated
  # elif type -P github-copilot-cli > /dev/null 2>&1; then
  #   cmd="github-copilot-cli"
  else
    echo "copilot is not installed" >&2
    return 1
  fi

  # Run the resolved command once at the end
  echo GITHUB_COPILOT_ALLOW_ALL_TOOLS=true command "$cmd" --allow-all "$@"
  GITHUB_COPILOT_ALLOW_ALL_TOOLS=true command "$cmd" --allow-all "$@"
}
alias co='copilot'
