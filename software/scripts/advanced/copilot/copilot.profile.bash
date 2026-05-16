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
  if ! type -P github-copilot-cli > /dev/null 2>&1; then
    echo "github-copilot-cli is not installed" >&2
    return 1
  fi
  command github-copilot-cli --allow-all "$@"
}
alias co='copilot'
