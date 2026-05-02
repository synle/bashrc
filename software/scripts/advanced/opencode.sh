#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install opencode - terminal-based AI coding agent (https://opencode.ai)

echo '> Installing opencode'

# Detect existing install. has_persistent_binary checks PATH and prints the
# resolved path (excluding /tmp/* fallbacks). Also probe the well-known install
# locations directly in case the shim has not been re-sourced into PATH yet.
OPENCODE_PATHS=(
  "${HOME}/.opencode/bin/opencode"
  "${HOME}/.local/bin/opencode"
)

OPENCODE_BIN="$(has_persistent_binary opencode || true)"
if [ -z "$OPENCODE_BIN" ]; then
  for p in "${OPENCODE_PATHS[@]}"; do
    if [ -f "$p" ]; then
      OPENCODE_BIN="$p"
      break
    fi
  done
fi

if [ -z "$OPENCODE_BIN" ]; then
  echo '>> Downloading and Installing'
  curl_bash_install https://opencode.ai/install
  for p in "${OPENCODE_PATHS[@]}"; do
    if [ -f "$p" ]; then
      OPENCODE_BIN="$p"
      break
    fi
  done
fi
