#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Skip in CI
((IS_CI)) && {
  printf '%s\n' ">>> Skipped : CI"
  exit 0
}

_VSCODE_EXT_LOG="/tmp/bashrc_bg_vscode_ext_$$.log"

printf '%s\n' "> Setting up VS Code Extensions (background, log: $_VSCODE_EXT_LOG)"

# Clean up the extensions manifest before installing so a corrupted / partially
# written extensions.json from a prior race can't poison the new install batch.
# `code --install-extension` rebuilds this file from the on-disk extension folders.
_VSCODE_EXT_CLEANUP_PATHS=(
  "$HOME/.vscode/extensions/extensions.json"
  "$HOME/.vscode/extensions/.obsolete"
  "$HOME/.vscode-insiders/extensions/extensions.json"
  "$HOME/.vscode-insiders/extensions/.obsolete"
)
if ((is_os_windows)); then
  # WSL -> native Windows VS Code extensions live under the Windows user profile.
  for _win_home in /mnt/c/Users/*/; do
    [ -d "$_win_home" ] || continue
    _VSCODE_EXT_CLEANUP_PATHS+=(
      "${_win_home}.vscode/extensions/extensions.json"
      "${_win_home}.vscode/extensions/.obsolete"
    )
  done
fi
for _vscode_ext_file in "${_VSCODE_EXT_CLEANUP_PATHS[@]}"; do
  [ -f "$_vscode_ext_file" ] && rm -f "$_vscode_ext_file" && printf '%s\n' ">> removed stale $_vscode_ext_file"
done

if ((is_os_mac)); then
  printf '%s\n' '>> mac'
  (curl -fsSL "$(get_github_raw_url .build/vs-code-ext-mac)" | bash -) > "$_VSCODE_EXT_LOG" 2>&1 &
elif ((is_os_windows)); then
  printf '%s\n' '>> windows'
  (curl -fsSL "$(get_github_raw_url .build/vs-code-ext-windows)" | bash -) > "$_VSCODE_EXT_LOG" 2>&1 &
else
  printf '%s\n' '>> linux'
  (curl -fsSL "$(get_github_raw_url .build/vs-code-ext-linux)" | bash -) > "$_VSCODE_EXT_LOG" 2>&1 &
fi
