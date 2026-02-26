#!/usr/bin/env bash
echo '>> Installing claude'
CLAUDE_BIN="${HOME}/.claude/bin/claude"
if ! command -v claude >/dev/null 2>&1 && [ ! -f "$CLAUDE_BIN" ]; then
  echo '  >> Downloading and Installing'
  curl -fsSL https://claude.ai/install.sh | bash > /dev/null 2>&1
fi

if [ -f "$CLAUDE_BIN" ] && [ ! -f /usr/local/bin/claude ]; then
  echo '  >> Symlinking /usr/local/bin/claude'
  sudo ln -sf "$CLAUDE_BIN" /usr/local/bin/claude
fi
