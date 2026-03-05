#!/usr/bin/env bash

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }

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

if ! command -v claude >/dev/null 2>&1 && [ -z "$CLAUDE_BIN" ]; then
  echo '>> Downloading and Installing'
  curl -fsSL https://claude.ai/install.sh | bash > /dev/null 2>&1
  for p in "${CLAUDE_PATHS[@]}"; do
    if [ -f "$p" ]; then
      CLAUDE_BIN="$p"
      break
    fi
  done
fi
