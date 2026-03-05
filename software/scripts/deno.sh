#!/usr/bin/env bash
# install deno - secure JavaScript/TypeScript runtime (https://deno.land)

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on OS where deno is installed via dependency files or unsupported
[ "$is_os_mac" = "1" ] && { echo ">>> Skipped : Installed via dependencies/mac.sh"; exit 0; }
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }

# Force refresh: remove existing binary
if [ "$IS_FORCE_REFRESH" == "1" ] && command -v deno &>/dev/null; then
  echo ">> Force refresh: removing deno"
  rm -rf "$HOME/.deno"
fi

# Install deno if not already installed
if command -v deno &>/dev/null; then
  echo ">> Skipped deno: already installed at $(which deno)"
else
  echo '>> Installing deno'
  echo '>>> Installing with official installer'
  curl -fsSL https://deno.land/install.sh | sh &>/dev/null
fi
