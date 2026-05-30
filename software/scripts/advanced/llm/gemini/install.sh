#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install gemini - Google's AI CLI tool (https://github.com/google-gemini/gemini-cli)
#
# Uses npm_install_global (Google publishes npm-only — no curl|bash installer exists).
# Bonus: on WSL `npm_install_global` auto-mirrors to the Windows host via
# `cmd.exe /c npm install -g`, giving a side-by-side install on both sides from a
# single call. See CLAUDE.md "LLM CLIs" exception for the broader policy.
echo '> Installing gemini cli'
npm_install_global @google/gemini-cli gemini

# ensure ~/.gemini directory exists (gemini crashes on first run without it)
safe_mkdir "$HOME/.gemini"
