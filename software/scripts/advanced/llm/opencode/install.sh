#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install opencode - terminal-based AI coding agent (https://opencode.ai)
#
# Uses npm_install_global (not the curl|bash native installer at opencode.ai/install)
# so that on WSL we get a side-by-side install on both the Linux side and the
# Windows host — `npm_install_global` auto-mirrors via `cmd.exe /c npm install -g`.
# A curl|bash install would only land on the current OS, forcing a separate winget
# step for the Windows side. See CLAUDE.md "LLM CLIs" exception for the policy.
echo '> Installing opencode'
# Sweep any legacy / wrong-arch globals from earlier installs so the fresh
# `npm_install_global opencode-ai opencode` call below resolves to the canonical
# package without colliding with a stale binary on PATH. Silenced because the
# packages may not be present (npm prints "not installed" warnings otherwise).
npm uninstall -g opencode-darwin-arm64 > /dev/null 2>&1
npm uninstall -g opencode-ai > /dev/null 2>&1
npm_install_global opencode-ai opencode
