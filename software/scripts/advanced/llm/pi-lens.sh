#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
# SOURCE software/scripts/advanced/llm/_common/pi-lens.common.bash

# Install the experimental MCP server independently of Pi. npm is the upstream
# distribution; lifecycle scripts remain disabled, including on the WSL host.
set -e

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)' || {
  echo '>> pi-lens MCP requires Node >=22.19.0' >&2
  exit 1
}

# The published server imports optional TUI and schema peers in headless MCP mode.
for pi_lens_package in "$PI_LENS_TUI_PACKAGE" "$PI_LENS_TYPEBOX_PACKAGE" "$PI_LENS_PACKAGE"; do
  pi_lens_manifest="$HOME/.local/lib/node_modules/${pi_lens_package%@*}/package.json"
  pi_lens_binary="${pi_lens_package##*/}"
  pi_lens_binary="${pi_lens_binary%@*}"
  [ "$pi_lens_package" = "$PI_LENS_PACKAGE" ] && pi_lens_binary='pi-lens-mcp'
  pi_lens_refresh="${IS_REFRESH_MODE:-0}"

  # A changed pin must override the generic helper's age-only freshness gate.
  if [ -f "$pi_lens_manifest" ] && ! node -e 'process.exit(require(process.argv[1]).version === process.argv[2] ? 0 : 1)' \
    "$pi_lens_manifest" "${pi_lens_package##*@}"; then
    pi_lens_refresh=1
  fi

  # Checked calls let the helper handle expected nonzero first-install discovery.
  # WSLENV forwards npm policy to cmd.exe for the mirrored Windows host install.
  WSLENV="${WSLENV:+$WSLENV:}npm_config_ignore_scripts/w" IS_REFRESH_MODE="$pi_lens_refresh" npm_config_ignore_scripts=true \
    npm_install_global "$pi_lens_package" "$pi_lens_binary" < /dev/null || {
    pi_lens_status=$?
    echo '>> pi-lens MCP install failed: npm helper returned nonzero' >&2
    exit "$pi_lens_status"
  }

  # npm_install_global can report install errors without failing; verify the payload.
  node -e 'process.exit(require(process.argv[1]).version === process.argv[2] ? 0 : 1)' \
    "$pi_lens_manifest" "${pi_lens_package##*@}" || {
    echo '>> pi-lens MCP install failed: package does not match pinned release' >&2
    exit 1
  }
done

has_persistent_binary pi-lens-mcp > /dev/null || {
  echo '>> pi-lens MCP install failed: executable missing' >&2
  exit 1
}
echo ">> TODO: EXPERIMENTAL pi-lens MCP — $PI_LENS_PACKAGE installed; verify client workspace and language-server readiness"
