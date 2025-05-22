#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install uv - fast Python package manager (https://github.com/astral-sh/uv)

# Force refresh: remove existing binary and venv if stale
if is_force_refresh_stale "$HOME/.local/bin/uv"; then
  if has_persistent_binary uv &> /dev/null; then
    echo ">> Force refresh: removing uv"
    rm -rf "$HOME/.local/bin/uv" "$HOME/.local/bin/uvx"
  fi
fi

# Install uv if not already installed
_bin=$(has_persistent_binary uv)
if [ -n "$_bin" ]; then
  echo ">> Skipped uv: already installed at $_bin"
else
  echo '>> Installing uv'
  echo '>>> Installing with official installer'
  curl_bash_install https://astral.sh/uv/install.sh
  # Source uv env so it's available immediately
  if [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
  elif [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
  elif [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi
