#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install gemini - Google's AI CLI tool (https://github.com/google-gemini/gemini-cli)

echo '> Installing gemini cli'

# install for Linux/WSL
_bin=$(has_persistent_binary gemini)
if [ -n "$_bin" ]; then
  echo ">> Skipped gemini (Linux): already installed at $_bin"
else
  echo '>> Downloading and Installing (Linux)'
  npm_install_global @google/gemini-cli
fi

# install for Windows host via WSL
if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
  if cmd.exe /c "where gemini" &> /dev/null; then
    echo ">> Skipped gemini (Windows): already installed"
  else
    echo '>> Downloading and Installing (Windows)'
    cmd.exe /c "npm install -g @google/gemini-cli" > /dev/null
  fi
fi

# ensure ~/.gemini directory exists (gemini crashes on first run without it)
mkdir -p "$HOME/.gemini"
