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

# A bun built for the wrong CPU arch still runs (translated), but Rosetta 2 has no AVX,
# so every launch prints "CPU lacks AVX support, strange crashes may occur". Drop it and
# reinstall natively — curl_bash_install runs the official installer through run_native,
# so it resolves the darwin-aarch64 download instead of darwin-x64.
if [ -n "$_bin" ] && binary_arch_mismatch "$_bin"; then
  echo ">> Reinstalling bun: $_bin is not built for $(get_native_arch)"
  rm -rf "$HOME/.bun"
  _bin=""
fi

if [ -n "$_bin" ]; then
  echo ">> Skipped bun: already installed at $_bin"
else
  echo '>> Installing bun'
  curl_bash_install https://bun.sh/install
fi
