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
# Adds `--allow-all` + GITHUB_COPILOT_ALLOW_ALL_TOOLS=true for autonomous mode:
# grants the agent permission to read/write files, execute shell commands and
# access the network without prompting per-action.
#
# Two layers of repo-managed config flow into Copilot:
#   1. Per-repo (handled below): the `copilot` function auto-symlinks
#      `.github/copilot-instructions.md` → `../CLAUDE.md` so per-project
#      Claude rules become per-project Copilot rules without a separately-
#      maintained instructions file.
#   2. User-level (handled by software/scripts/advanced/llm/copilot/setup.js):
#      seeds defaults into `~/.copilot/settings.json` and deploys the shared
#      engineering principles into `~/.copilot/AGENTS.md` between
#      `<!-- BEGIN managed-rules --> / <!-- END managed-rules -->` markers,
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
  echo "GITHUB_COPILOT_ALLOW_ALL_TOOLS=true command copilot --allow-all $*" >&2
  # `command copilot` bypasses this function so the call hits the real binary, not us.
  GITHUB_COPILOT_ALLOW_ALL_TOOLS=true command copilot --allow-all "$@"
}
alias co='copilot'
