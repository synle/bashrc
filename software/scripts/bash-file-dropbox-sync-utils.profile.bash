#!/usr/bin/env bash

################################################################################
# --- Dropbox File / Sync Utilities ---
#
# Everything that hangs off `_dropbox_folder` (defined in
# bash-shared-folder.profile.bash) lives here.
#
# --- Git Patch Helpers ---
# patch_cleanup              — archive loose .patch files, keep newest N.
#                              Creating and applying patches lives in
#                              bash-git-helpers.profile.bash (git_patch_create /
#                              git_patch_apply); only housekeeping is here.
#
# --- Notes ---
# note                       — open a shared notes file from the dropbox folder
#
# --- Sync ---
# sync_to_dropbox            — sync a file/folder into the dropbox folder.
#                              Thin wrapper over `cpsync` (bash-file-utils),
#                              so skip-if-unchanged, overwrite reporting,
#                              progress and ETA all come for free.
################################################################################

################################################################################
# --- Git Patch Housekeeping (Dropbox) ---
# The transfer itself lives in bash-git-helpers.profile.bash as git_patch_create
# / git_patch_apply — both reach into this same dropbox folder. What stays here
# is the folder's own housekeeping.
################################################################################

# patch_cleanup: archive loose .patch files, keep only the N newest in archived_patch
function patch_cleanup() {
  if is_help_arg "${1:-}"; then
    echo "patch_cleanup: move loose .patch files into archived_patch and keep only the newest N
  Usage: patch_cleanup [keep=3]
  Examples:
    patch_cleanup       keep 3 newest patches (default)
    patch_cleanup 5     keep 5 newest patches"
    return
  fi

  local keep="${1:-3}"
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local archive_folder="${dropbox_folder}/archived_patch"

  mkdir -p "$archive_folder"

  # move any loose .patch files from dropbox root into the archive folder
  local moved=0
  for f in "$dropbox_folder"/*.patch; do
    [ -f "$f" ] || continue
    mv "$f" "$archive_folder/"
    moved=$((moved + 1))
  done
  echo "Moved $moved .patch file(s) to $archive_folder"

  # sort by modification time (newest first), remove all but the newest N
  local removed=0
  local count=0
  while IFS= read -r f; do
    count=$((count + 1))
    if [ "$count" -gt "$keep" ]; then
      echo "  Removing: $(basename "$f")"
      rm "$f"
      removed=$((removed + 1))
    fi
  done < <(ls -t "$archive_folder"/*.patch 2> /dev/null)

  echo "Kept $keep newest, removed $removed old .patch file(s)"
}

################################################################################
# --- Notes (Dropbox) ---
# Opens a shared notes file from the Dropbox notes folder.
# With a truthy arg, creates and opens a timestamped note instead.
################################################################################
# open notes file
function note() {
  if is_help_arg "${1:-}"; then
    echo "
      note: open a shared notes file from Dropbox
        note               open _note.txt
        note 1             create and open a timestamped _note_<timestamp>.txt
        note true|y|yes    same as above
    "
    return 0
  fi

  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local notes_folder="${dropbox_folder}/notes"
  if [ ! -d "$notes_folder" ]; then
    echo "No dropbox notes folder found: $notes_folder"
    return 1
  fi
  local file
  if is_truthy "${1:-}"; then
    file="${notes_folder}/_note_$(command date +%Y-%m-%d-%H-%M).txt"
    touch "$file"
  else
    file="${notes_folder}/_note.txt"
  fi
  if type -P run_editor &> /dev/null; then
    run_editor "$file"
  elif type -P subl &> /dev/null; then
    subl "$file"
  else
    ${EDITOR:-vim} "$file"
  fi
}

################################################################################
# --- Sync To Dropbox ---
# Thin wrapper over `cpsync` (bash-file-utils.profile.bash) that defaults the
# destination to the dropbox folder. cpsync already does the heavy lifting:
# unchanged files are skipped, changed files are overwritten and reported as
# OVER, and a per-file + summary log is printed for monitoring.
################################################################################
# sync_to_dropbox: sync a file or folder into the dropbox folder
function sync_to_dropbox() {
  if is_help_arg "${1:-}"; then
    echo "sync_to_dropbox: sync a file or folder into the shared dropbox folder
  Usage: sync_to_dropbox <src> [dest=<dropbox folder>] [lookback_days=0] [max_size_gb=5]
  Examples:
    sync_to_dropbox ~/Downloads                  sync every file in ~/Downloads into the dropbox folder
    sync_to_dropbox ~/notes.txt                  sync a single file into the dropbox folder
    sync_to_dropbox ~/Downloads /mnt/z/dropbox   sync into an explicit destination folder
    sync_to_dropbox ~/Downloads '' 7 20          re-copy text files changed in the last 7 days, 20GB cap
  src must already exist (file or folder); dest must already be an existing folder.
  Conflicts: a src file that already exists in dest is skipped when unchanged
  (same size, plus same word count for text files) and otherwise overwritten.
  Every file is echoed as SKIP / COPY / OVER / FAIL, with totals at the end."
    return 0
  fi

  local src="${1:-}"
  if [ -z "$src" ]; then
    echo "sync_to_dropbox: missing <src>. See: sync_to_dropbox --help"
    return 1
  fi
  if [ ! -e "$src" ]; then
    echo "sync_to_dropbox: source not found: $src"
    return 1
  fi

  local sync_folder="${2:-}"
  if [ -z "$sync_folder" ]; then
    local dropbox_folder
    dropbox_folder=$(_dropbox_folder) || {
      echo "No dropbox folder found"
      return 1
    }
    sync_folder="${dropbox_folder}"
  fi
  if [ ! -d "$sync_folder" ]; then
    echo "sync_to_dropbox: destination folder not found: $sync_folder"
    return 1
  fi

  # lookback 0 => text files are compared on content shape only, never re-copied
  # just because they are recent, which keeps repeat syncs cheap
  cpsync "$src" "$sync_folder" "${3:-0}" "${4:-5}"
}
