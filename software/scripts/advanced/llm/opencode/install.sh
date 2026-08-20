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
#
# NOTE: this uninstall/reinstall cycle can take out `~/.local/share/opencode/`,
# including `auth.json`. `opencode/setup.js` runs right after and keeps that path
# as a symlink onto `~/.auth-opencode.json`, so provider logins live outside the
# blast radius and are relinked on every refresh.
npm uninstall -g opencode-darwin-arm64 > /dev/null 2>&1
npm uninstall -g opencode-ai > /dev/null 2>&1
npm_install_global opencode-ai opencode

# install snip - shell-output filter (https://github.com/edouard-claude/snip)
#
# Required by the `opencode-snip` plugin registered in opencode/setup.js: the
# plugin shells out to this binary, and without it the plugin is a silent no-op.
#
# The official installer is one POSIX-sh script covering macOS (Intel + Apple
# Silicon) and Linux (x86_64 + ARM), so no per-OS branch is needed. It installs
# to /usr/local/bin when writable and falls back to ~/.local/bin otherwise, which
# is already on PATH here — so this never needs sudo.
#
# Piped through `run_native` because the installer picks its download by parsing
# `uname -m`, which lies under Rosetta 2: an Intel-launched shell on Apple
# Silicon reports x86_64, and every child inherits it, so a plain `| sh` would
# fetch the Intel build and install a translated binary that works but runs slow
# and reports the wrong arch forever after.
#
# Guarded by has_persistent_binary so a re-run is a no-op; force a refresh by
# removing the binary, since the installer always fetches the latest release.
if ! has_persistent_binary snip; then
  echo '> Installing snip (required by the opencode-snip plugin)'
  curl -fsSL https://raw.githubusercontent.com/edouard-claude/snip/master/install.sh | run_native sh > /dev/null
fi
