#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install pi - minimal, programmable AI coding agent harness (https://pi.dev)
#
# Uses npm_install_global (not the curl|bash native installer at pi.dev/install.sh)
# so that on WSL we get a side-by-side install on both the Linux side and the
# Windows host — `npm_install_global` auto-mirrors via `cmd.exe /c npm install -g`.
# A curl|bash install would only land on the current OS, forcing a separate winget
# step for the Windows side. See CLAUDE.md "LLM CLIs" exception for the policy.
#
# Package name differs from the binary name, so pass both: the published npm
# package is `@earendil-works/pi-coding-agent` and it installs the `pi` launcher.
echo '> Installing pi'
npm_install_global @earendil-works/pi-coding-agent pi
