#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install GitHub Copilot CLI - https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli
#
# Single install path on mac / Linux / WSL: the official GitHub installer at
# https://gh.io/copilot-install (script source: https://github.com/github/copilot-cli/install.sh).
# It downloads the prebuilt `copilot-${PLATFORM}-${ARCH}.tar.gz` release tarball
# and drops `copilot` into $HOME/.local/bin (PREFIX defaults to $HOME/.local for
# non-root). On Windows-native the same upstream installer routes to
# `winget install GitHub.Copilot` — we run that path through winget directly
# (see software/scripts/windows/_winget-install.sh).
echo '> Installing GitHub Copilot CLI'
curl_bash_install https://gh.io/copilot-install
