#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

echo '> Installing claude'
CLAUDE_PATHS=(
  "${HOME}/.claude/bin/claude"
  "${HOME}/.local/bin/claude"
)

CLAUDE_BIN=""
for p in "${CLAUDE_PATHS[@]}"; do
  if [ -f "$p" ]; then
    CLAUDE_BIN="$p"
    break
  fi
done

if ! type -P claude > /dev/null 2>&1 && [ -z "$CLAUDE_BIN" ]; then
  echo '>> Downloading and Installing'
  curl_bash_install https://claude.ai/install.sh
  for p in "${CLAUDE_PATHS[@]}"; do
    if [ -f "$p" ]; then
      CLAUDE_BIN="$p"
      break
    fi
  done
fi
