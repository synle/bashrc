#!/usr/bin/env bash
# software/bootstrap/setup.sh - Universal bootstrap script for all platforms
# Prerequisites (Homebrew, curl, unzip) are handled in software/scripts/<os>/_full-setup.sh

if [ "$(printf '%s\n' "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "true" ] || [ "$(printf '%s\n' "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "1" ]; then
  printf '%s\n' ">> SKIP_SETUP is set, skipping dependency setup"
  curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/run.sh | bash
else
  curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/run.sh | bash -s -- --setup
fi
