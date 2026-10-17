#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install opencode - terminal-based AI coding agent (https://opencode.ai)
#
# Uses npm_install_global (not the curl|bash native installer at opencode.ai/install)
# so that on WSL we get a side-by-side install on both the Linux side and the
# Windows host — `npm_install_global` auto-mirrors via `cmd.exe /c npm install -g`.
# A curl|bash install would only land on the current OS, forcing a separate winget
# step for the Windows side. See CLAUDE.md "LLM CLIs" exception for the policy.
echo '> Installing opencode'

echo -n '>> opencode >> Installing latest as canonical command >> '
if npm_install_global opencode-ai@latest opencode; then
  echo 'Success'
else
  echo 'Error (non-fatal)'
fi

# Refresh the model catalog only when explicitly requested.
if ((IS_REFRESH_MODE)) && has_persistent_binary opencode > /dev/null; then
  echo -n '>> opencode >> Refreshing model catalog >> '
  if opencode models --refresh < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    echo 'Success'
  else
    echo 'Error (non-fatal)'
  fi
fi
