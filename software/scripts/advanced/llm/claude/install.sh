#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install claude code - Anthropic's Claude CLI (https://docs.claude.com/en/docs/claude-code)
#
# Uses npm_install_global (not the curl|bash native installer at claude.ai/install.sh)
# so that on WSL we get a side-by-side install on both the Linux side and the
# Windows host — `npm_install_global` auto-mirrors via `cmd.exe /c npm install -g`.
# A curl|bash install would only land on the current OS, forcing a separate winget
# step for the Windows side. Trade-off: lose the native installer's self-update;
# refresh comes from `bash run.sh --force-refresh --files=claude` instead.
echo '> Installing claude'
npm_install_global @anthropic-ai/claude-code claude
