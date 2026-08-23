#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install snip - LLM output token filter (https://github.com/edouard-claude/snip)
# Pairs with software/scripts/bash-snip.profile.bash, which ships the `sn`,
# snip_coverage and snip_logs helpers and degrades gracefully when the binary
# is absent. This script is what makes it present on a fresh machine.

_bin=$(has_persistent_binary snip)

# Force refresh: remove existing binary if stale
if [ -n "$_bin" ] && is_force_refresh_stale "$_bin"; then
  echo ">> Force refresh: removing snip"
  rm -f "$_bin"
  _bin=""
fi

if [ -n "$_bin" ]; then
  echo ">> Skipped snip: already installed at $_bin"
else
  # NOTE: snip's installer is POSIX sh (#!/bin/sh); pipe to `sh`, not `bash`.
  # It installs to /usr/local/bin when writable, otherwise $HOME/.local/bin.
  # Supports darwin + linux only — Windows has no release from this installer.
  echo '>> Installing snip'
  curl -fsSL https://raw.githubusercontent.com/edouard-claude/snip/master/install.sh | sh > /dev/null
fi

# Agent integration (Copilot hook, Gemini prompt injection) is NOT done here.
# `snip init --agent <x>` OVERWRITES the agent's config file — for Gemini it
# replaces the whole ~/.gemini/GEMINI.md, wiping the repo-managed instructions.
# Instead the LLM setup owns it, merge-safe: copilot/setup.js writes
# ~/.copilot/hooks/snip.json and gemini/setup.js appends a managed snip block to
# GEMINI.md, each preserving everything already there.
