#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

echo '> Installing gemini cli'

if type -P gemini &> /dev/null; then
  echo ">> Skipped gemini: already installed at $(type -P gemini)"
else
  echo '>> Downloading and Installing'
  npm_install_global @google/gemini-cli
fi
