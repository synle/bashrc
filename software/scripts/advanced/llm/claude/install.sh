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
#
# Deliberately no `rm -f ~/.local/bin/claude` / `rm -rf ~/.local/share/claude` here.
# That pair used to run unconditionally as a leftover from migrating off the native
# installer, and it broke the install outright: npm_install_global's freshness gate saw
# the still-fresh ~/.local/lib/node_modules/@anthropic-ai/claude-code tree, skipped the
# npm call, and left the just-deleted launcher gone — `claude: command not found` with a
# fully installed package tree on disk. The gate now treats a missing launcher as a broken
# install and reinstalls on its own, so the wipe is both unnecessary and harmful (it would
# re-download the ~270MB binary on every single run).

echo '> Installing claude'
npm_install_global @anthropic-ai/claude-code claude
