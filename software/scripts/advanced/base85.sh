#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Install the shared Base85 module used by the `base85` shell function and `patch_85`.
# SOURCE software/scripts/bash-base85.profile.bash

printf '%s\n' '> Installing Base85 module'
WSLENV="${WSLENV:+$WSLENV:}npm_config_ignore_scripts/w" npm_config_ignore_scripts=true \
  npm_install_global "$_BASE85_NPM_PACKAGE" || exit $?

if [ ! -f "$HOME/.local/lib/node_modules/base85/package.json" ]; then
  printf '%s\n' "base85: npm install did not place the module in '$HOME/.local/lib/node_modules/base85'" >&2
  exit 1
fi
