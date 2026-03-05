#!/usr/bin/env bash
# install bun - fast JavaScript runtime and toolkit (https://bun.sh)

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on OS where bun is installed via dependency files or unsupported
[ "$is_os_mac" = "1" ] && { echo ">>> Skipped : Installed via dependencies/mac.sh"; exit 0; }
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }

# Force refresh: remove existing binary
if [ "$IS_FORCE_REFRESH" == "1" ] && command -v bun &>/dev/null; then
  echo ">> Force refresh: removing bun"
  rm -rf "$HOME/.bun"
fi

# Install bun if not already installed
if command -v bun &>/dev/null; then
  echo ">> Skipped bun: already installed at $(which bun)"
else
  echo '>> Installing bun'
  echo '>>> Installing with official installer'
  curl -fsSL https://bun.sh/install | bash &>/dev/null
fi
