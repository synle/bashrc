#!/usr/bin/env bash
################################################################################
# --- Shared Network Folder ---
# Common base for features that use the shared network volume (dropbox, patches,
# notes, screenshots). Callers append their own subpath.
################################################################################

# shared helper to find the network share root (WSL /mnt/z or macOS /Volumes)
function _shared_folder() {
  [ -n "${BASHRC_SHARED_FOLDER:-}" ] && [ -d "$BASHRC_SHARED_FOLDER" ] && echo "$BASHRC_SHARED_FOLDER" && return 0
  local candidates=(
    "/mnt/z"
    "/Volumes/192.168.1.1"
  )
  find_path "${candidates[@]}" --folder
}

# shared helper to find the dropbox folder (used by patch and note functions)
function _dropbox_folder() {
  local shared_folder
  shared_folder=$(_shared_folder) || return 1
  local dropbox="${shared_folder}/dropbox"
  [ -d "$dropbox" ] && echo "$dropbox" || return 1
}

# dropbox: open the dropbox folder
function dropbox() {
  if is_help_arg "${1:-}"; then
    echo "dropbox: open the dropbox folder
  Usage: dropbox"
    return 0
  fi

  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  open "$dropbox_folder" &> /dev/null || echo "$dropbox_folder"
}
