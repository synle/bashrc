#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# set up Python virtual environment with uv at ~/.venv

# Source uv env if not already in PATH
if ! type -P uv &> /dev/null; then
  if [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
  elif [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
  fi
  # Fallback: add common uv install dirs to PATH directly
  if ! type -P uv &> /dev/null; then
    [ -f "$HOME/.local/bin/uv" ] && export PATH="$HOME/.local/bin:$PATH"
    [ -f "$HOME/.cargo/bin/uv" ] && export PATH="$HOME/.cargo/bin:$PATH"
  fi
fi

# Skip if uv is not installed
! type -P uv &> /dev/null && {
  echo ">>> Skipped : uv is not installed"
  exit 0
}

# Force refresh: remove existing venv (only if stale)
if is_force_refresh_stale "$HOME/.venv"; then
  echo ">> Force refresh: removing ~/.venv"
  rm -rf "$HOME/.venv"
fi

# Set up Python virtual environment at ~/.venv
export UV_VENV_CLEAR="1"
if [ ! -d "$HOME/.venv" ]; then
  echo '>> Creating Python 3.12 virtual environment at ~/.venv'
  uv venv --python 3.12 "$HOME/.venv" > /dev/null
else
  echo '>> Skipped ~/.venv: already exists'
fi
