#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install gemini - Google's AI CLI tool (https://github.com/google-gemini/gemini-cli)

echo '> Installing gemini cli'

_bin=$(has_persistent_binary gemini)
if [ -n "$_bin" ]; then
  echo ">> Skipped gemini: already installed at $_bin"
else
  echo '>> Downloading and Installing'
  npm_install_global @google/gemini-cli
fi

# ensure ~/.gemini directory exists (gemini crashes on first run without it)
mkdir -p "$HOME/.gemini"
