#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install GitHub Copilot CLI - https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli
#
# Uses npm_install_global (not the curl|bash native installer at gh.io/copilot-install)
# so that on WSL we get a side-by-side install on both the Linux side and the
# Windows host — `npm_install_global` auto-mirrors via `cmd.exe /c npm install -g`.
# A curl|bash install would only land on the current OS, forcing a separate winget
# step for the Windows side. Trade-off: lose the native installer's winget routing;
# refresh comes from `bash run.sh --force-refresh --files=copilot` instead.
echo '> Installing GitHub Copilot CLI'
npm_install_global @github/copilot copilot
