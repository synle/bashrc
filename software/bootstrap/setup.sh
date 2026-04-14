#!/usr/bin/env bash
# software/bootstrap/setup.sh - Universal bootstrap script for all platforms
# Prerequisites (Homebrew, curl, unzip) are handled in software/scripts/<os>/_full-setup.sh

if [ "$(echo "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "true" ] || [ "$(echo "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "1" ]; then
  echo ">> SKIP_SETUP is set, skipping dependency setup"
  curl -fsSL https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash
else
  curl -fsSL https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --setup
fi
