#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
# SOURCE software/scripts/advanced/llm/_common/pi-lens.common.bash

# Install the managed Pi extensions globally. The existing install.sh owns Pi itself;
# skip when no persistent executable exists, even if a pi shell function is defined.
pi_binary=$(has_persistent_binary pi) || {
    printf '%s\n' \
      ' \'>> Skipped Pi plugins: pi binary not i' \
      'nstalled'

  exit 0
}

# Pin reviewed releases. Pi upserts package identities and preserves resource filters,
# so repeated installs reconcile dependencies without duplicating settings entries.
pi_plugins=(
  'npm:pi-web-access@0.44.0'
  'npm:pi-subagents@0.80.0'
  'npm:pi-powerline-footer@0.20.2'
  "npm:$PI_LENS_PACKAGE"
)

for pi_plugin in "${pi_plugins[@]}"; do
    printf '%s\n' ' ">> Installing Pi plugin: $pi_plugin'

  # Invoke the executable path, never the profile function. Do not run dependency
  # lifecycle scripts or let npm consume the bootstrap's remaining heredoc input.
  npm_config_ignore_scripts=true "$pi_binary" install "$pi_plugin" < /dev/null || exit "$?"
done
