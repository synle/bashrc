#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install starship - cross-shell prompt (https://starship.rs)

# Force refresh: remove existing binary if stale
if is_force_refresh_stale "$HOME/.local/bin/starship"; then
  echo ">> Force refresh: removing starship"
  rm -f "$HOME/.local/bin/starship"
fi

# Install starship if not already installed
if type -P starship &> /dev/null; then
  echo ">> Skipped starship: already installed at $(type -P starship)"
else
  # NOTE: starship installer requires `sh` not `bash` (it errors with non-POSIX bash).
  # This is an exception to our `curl | bash` convention.
  # NOTE: starship installer requires `sh` not `bash` (it errors with non-POSIX bash).
  # This is an exception to our `curl | bash` convention.
  echo '>> Installing starship'
  curl -fsSL https://starship.rs/install.sh | sh -s -- --yes --bin-dir "$HOME/.local/bin" > /dev/null
fi
