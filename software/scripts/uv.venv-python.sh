#!/usr/bin/env bash
# set up Python virtual environment with uv at ~/.venv

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }

# Skip if uv is not installed
! command -v uv &>/dev/null && { echo ">>> Skipped : uv is not installed"; exit 0; }

# Force refresh: remove existing venv
if [ "$IS_FORCE_REFRESH" == "1" ] && [ -d "$HOME/.venv" ]; then
  echo ">> Force refresh: removing ~/.venv"
  rm -rf "$HOME/.venv"
fi

# Set up Python virtual environment at ~/.venv
export UV_VENV_CLEAR="1"
if [ ! -d "$HOME/.venv" ]; then
  echo '>> Creating Python 3.12 virtual environment at ~/.venv'
  uv venv --python 3.12 "$HOME/.venv" &>/dev/null
else
  echo '>> Skipped ~/.venv: already exists'
fi
