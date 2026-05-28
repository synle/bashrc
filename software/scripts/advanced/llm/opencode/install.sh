#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install opencode - terminal-based AI coding agent (https://opencode.ai)

echo '> Installing opencode'
npm uninstall -g opencode-darwin-arm64
npm uninstall -g opencode-ai
npm_install_global opencode-ai opencode
