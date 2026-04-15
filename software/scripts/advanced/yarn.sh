#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install yarn - JavaScript package manager (https://yarnpkg.com)

echo '> Installing yarn'

_bin=$(type -P yarn 2>/dev/null)
if [ -n "$_bin" ] && [[ "$_bin" != /tmp/* ]]; then
  echo ">> Skipped yarn: already installed at $_bin"
else
  echo '>> Downloading and Installing'
  npm_install_global yarn
fi
