#!/usr/bin/env bash
# install uv - fast Python package manager (https://github.com/astral-sh/uv)

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }

# Force refresh: remove existing binary and venv
if [ "$IS_FORCE_REFRESH" == "1" ]; then
  if command -v uv &>/dev/null; then
    echo ">> Force refresh: removing uv"
    rm -rf "$HOME/.local/bin/uv" "$HOME/.local/bin/uvx"
  fi
  if [ -d "$HOME/.venv" ]; then
    echo ">> Force refresh: removing ~/.venv"
    rm -rf "$HOME/.venv"
  fi
fi

# Install uv if not already installed
if command -v uv &>/dev/null; then
  echo ">> Skipped uv: already installed at $(which uv)"
elif [ "$is_os_mac" == "1" ]; then
  echo ">> Skipped uv: Installed via dependencies/mac.sh"
else
  echo '>> Installing uv'
  echo '>>> Installing with official installer'
  curl -LsSf https://astral.sh/uv/install.sh | sh &>/dev/null
fi

# Set up Python virtual environment at ~/.venv
export UV_VENV_CLEAR="1"
if [ ! -d "$HOME/.venv" ]; then
  echo '>> Creating Python 3.12 virtual environment at ~/.venv'
  uv venv --python 3.12 "$HOME/.venv" &>/dev/null
else
  echo '>> Skipped ~/.venv: already exists'
fi
