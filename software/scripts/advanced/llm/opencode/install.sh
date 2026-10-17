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
# Sweep any legacy / wrong-arch globals from earlier installs before installing
# the latest package as the canonical command. Silenced because the packages may
# not be present (npm prints "not installed" warnings otherwise).
#
# NOTE: this uninstall/reinstall cycle can take out `~/.local/share/opencode/`,
# including `auth.json`. `opencode/setup.js` runs right after and keeps that path
# as a symlink onto `~/.auth-opencode.json`, so provider logins live outside the
# blast radius and are relinked on every refresh.
npm uninstall -g opencode-darwin-arm64 > /dev/null 2>&1
npm uninstall -g opencode-ai > /dev/null 2>&1
# The freshness gate keys off the package tree. Remove the old stable tree so
# `opencode-ai@latest` cannot be mistaken for an already-installed v1 package.
rm -rf "$HOME/.local/lib/node_modules/opencode-ai"
echo -n '>> opencode >> Installing latest as canonical command >> '
if npm_install_global opencode-ai@latest opencode; then
  echo 'Success'
else
  echo 'Error (non-fatal)'
fi

# OpenCode keeps provider metadata in a models.dev-backed cache. Refresh that cache
# only for an explicit `--refresh=opencode/install.sh` run; normal setup stays offline
# from this extra request. A catalog refresh cannot expose a model until models.dev
# publishes it, but it prevents a stale local cache from hiding newly published models.
if ((IS_REFRESH_MODE)) && has_persistent_binary opencode > /dev/null; then
  echo -n '>> opencode >> Refreshing model catalog >> '
  if opencode models --refresh < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    echo 'Success'
  else
    echo 'Error (non-fatal)'
  fi
fi
