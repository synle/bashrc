#!/usr/bin/env bash
echo '>> Installing claude'
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

if ! command -v claude >/dev/null 2>&1 && [ -z "$CLAUDE_BIN" ]; then
  echo '  >> Downloading and Installing'
  curl -fsSL https://claude.ai/install.sh | bash > /dev/null 2>&1
  for p in "${CLAUDE_PATHS[@]}"; do
    if [ -f "$p" ]; then
      CLAUDE_BIN="$p"
      break
    fi
  done
fi

if [ -n "$CLAUDE_BIN" ] && [ ! -f /usr/local/bin/claude ]; then
  sudo ln -sf "$CLAUDE_BIN" /usr/local/bin/claude
fi
