#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Install the reviewed CodeGraph release without letting its installer own MCP configs.
# The official Unix installer bundles its runtime; Windows uses the npm launcher
# because the shell installer explicitly refuses MSYS/MinGW. Termux is unsupported.
set -e
set -o pipefail

CODEGRAPH_PINNED_VERSION='1.6.2'
export CODEGRAPH_TELEMETRY=0

if ((is_os_android_termux)); then
    printf '%s\n' \
      ' \'>> CodeGraph skipped: no supported Ter' \
      'mux build'

  exit 0
fi

codegraph_binary=$(has_persistent_binary codegraph) || codegraph_binary=''
if [ -n "$codegraph_binary" ] && [ "$("$codegraph_binary" --version)" = "$CODEGRAPH_PINNED_VERSION" ]; then
    printf '%s\n' \
      ' ">> CodeGraph $CODEGRAPH_PINNED_VERSION ' \
      'already installed'

  exit 0
fi

if ((is_os_mingw64)); then
  npm_config_ignore_scripts=true npm_install_global "@colbymchenry/codegraph@$CODEGRAPH_PINNED_VERSION" codegraph
else
  # run_native prevents uname in the vendor installer choosing Intel under Rosetta.
  curl -fsSL "https://raw.githubusercontent.com/colbymchenry/codegraph/v$CODEGRAPH_PINNED_VERSION/install.sh" \
    | CODEGRAPH_VERSION="$CODEGRAPH_PINNED_VERSION" run_native bash
fi

codegraph_binary=$(has_persistent_binary codegraph) || {
  echo '>> CodeGraph install failed: executable missing' >&2
  exit 1
}
if [ "$("$codegraph_binary" --version)" != "$CODEGRAPH_PINNED_VERSION" ]; then
  echo '>> CodeGraph install failed: PATH executable does not match pinned release' >&2
  exit 1
fi
