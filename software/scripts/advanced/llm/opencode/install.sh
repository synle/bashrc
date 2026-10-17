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

# Self-update when opencode is already installed. npm_install_global can no-op
# on normal runs; `opencode upgrade` pulls newer point releases in place.
#
# Force the npm upgrade method to match how this repo installs opencode. Pipe
# `yes` so any confirmation prompt is accepted non-interactively.
if ! ((IS_CI)) && has_persistent_binary opencode > /dev/null; then
  echo -n '>> opencode >> Updating to latest stable >> '
  if yes | opencode upgrade --method npm >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    echo 'Success'
  else
    echo 'Error (non-fatal)'
  fi
fi

# OpenCode 2 remains isolated from the stable v1 install. Upstream's
# `opencode upgrade --major` removes v1, so install the published beta channel
# under its own prefix and expose it only through the opencode_2 wrapper below.
# npm reconciles this prefix idempotently and never replaces ~/.local/bin/opencode.
OPENCODE_2_PREFIX="$HOME/.local/opencode-2"
echo -n '>> opencode 2 beta >> Installing isolated npm prefix >> '
if npm install -g --prefix "$OPENCODE_2_PREFIX" opencode-ai@beta < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
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

if ((IS_REFRESH_MODE)) && [ -x "$OPENCODE_2_PREFIX/bin/opencode" ]; then
  echo -n '>> opencode 2 beta >> Refreshing model catalog >> '
  if "$OPENCODE_2_PREFIX/bin/opencode" models --refresh < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    echo 'Success'
  else
    echo 'Error (non-fatal)'
  fi
fi
