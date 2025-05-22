#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install bun - fast JavaScript runtime and toolkit (https://bun.sh)

# Force refresh: remove existing binary (only if stale)
if is_force_refresh_stale "$HOME/.bun"; then
  echo ">> Force refresh: removing bun"
  rm -rf "$HOME/.bun"
fi

# Install bun if not already installed
_bin=$(has_persistent_binary bun)
if [ -n "$_bin" ]; then
  echo ">> Skipped bun: already installed at $_bin"
else
  echo '>> Installing bun'
  curl_bash_install https://bun.sh/install
fi
