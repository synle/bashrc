#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install deno - secure JavaScript/TypeScript runtime (https://deno.land)

# Force refresh: remove existing binary (only if stale)
if is_force_refresh_stale "$HOME/.deno"; then
  echo ">> Force refresh: removing deno"
  rm -rf "$HOME/.deno"
fi

# Install deno if not already installed
if type -P deno &> /dev/null; then
  echo ">> Skipped deno: already installed at $(type -P deno)"
else
  echo '>> Installing deno'
  curl_bash_install https://deno.land/install.sh
fi
