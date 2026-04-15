#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install gemini - Google's AI CLI tool (https://github.com/google-gemini/gemini-cli)

echo '> Installing gemini cli'

if [ -x "$HOME/.local/bin/gemini" ]; then
  echo ">> Skipped gemini: already installed at $HOME/.local/bin/gemini"
else
  echo '>> Downloading and Installing'
  npm_install_global @google/gemini-cli
fi

# ensure ~/.gemini directory exists (gemini crashes on first run without it)
mkdir -p "$HOME/.gemini"
