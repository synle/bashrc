#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install opencode - terminal-based AI coding agent (https://opencode.ai)

echo '> Installing opencode'
# Sweep any legacy / wrong-arch globals from earlier installs so the fresh
# `npm_install_global opencode-ai opencode` call below resolves to the canonical
# package without colliding with a stale binary on PATH. Silenced because the
# packages may not be present (npm prints "not installed" warnings otherwise).
npm uninstall -g opencode-darwin-arm64 > /dev/null 2>&1
npm uninstall -g opencode-ai > /dev/null 2>&1
npm_install_global opencode-ai opencode
