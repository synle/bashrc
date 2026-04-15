#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install yarn - JavaScript package manager (https://yarnpkg.com)

echo '> Installing yarn'

_bin=$(has_persistent_binary yarn)
if [ -n "$_bin" ]; then
  echo ">> Skipped yarn: already installed at $_bin"
else
  echo '>> Downloading and Installing'
  npm_install_global yarn
fi
