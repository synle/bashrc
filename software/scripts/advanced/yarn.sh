#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install yarn - JavaScript package manager (https://yarnpkg.com)

echo '> Installing yarn'

if [ -x "$HOME/.local/bin/yarn" ]; then
  echo ">> Skipped yarn: already installed at $HOME/.local/bin/yarn"
else
  echo '>> Downloading and Installing'
  npm_install_global yarn
fi
