#!/usr/bin/env bash

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }

echo '> Setting up VS Code Extensions'

if [ "$is_os_mac" = "1" ]; then
  echo '>> mac osx'
  curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-ext-macosx" | bash - &
elif [ "$is_os_windows" = "1" ]; then
  echo '>> windows'
  curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-ext-windows" | bash - &
else
  echo '>> linux'
  curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-ext-linux" | bash - &
fi
