#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Skip in CI
((IS_CI)) && {
  echo ">>> Skipped : CI"
  exit 0
}

_VSCODE_EXT_LOG="/tmp/bashrc_bg_vscode_ext_$$.log"

echo "> Setting up VS Code Extensions (background, log: $_VSCODE_EXT_LOG)"

if ((is_os_mac)); then
  echo '>> mac'
  (curl -fsSL "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-ext-mac" | bash -) > "$_VSCODE_EXT_LOG" 2>&1 &
elif ((is_os_windows)); then
  echo '>> windows'
  (curl -fsSL "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-ext-windows" | bash -) > "$_VSCODE_EXT_LOG" 2>&1 &
else
  echo '>> linux'
  (curl -fsSL "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-ext-linux" | bash -) > "$_VSCODE_EXT_LOG" 2>&1 &
fi
