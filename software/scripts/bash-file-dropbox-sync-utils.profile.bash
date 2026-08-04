#!/usr/bin/env bash

################################################################################
# --- Dropbox File / Sync Utilities ---
#
# Everything that hangs off `_dropbox_folder` (defined in
# bash-shared-folder.profile.bash) lives here.
#
# --- Git Patch Helpers ---
# _patch_create_and_upload   — export last commit as .patch, prefix with
#                              repo-date, move it into the dropbox folder
# _patch_download_and_apply  — apply the newest .patch from dropbox, commit,
#                              archive the file
# _patch_view_copy           — copy the last commit's patch to the clipboard
# patch_cleanup              — archive loose .patch files, keep newest N
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
# --- Git Patch Helpers (Dropbox) ---
# Transfers git patches between machines via a shared Dropbox folder.
# _patch_create_and_upload: exports the last commit as a .patch, renames with
#   a repo-date prefix, and moves it to Dropbox.
# _patch_download_and_apply: finds the most recent .patch in Dropbox, applies
#   it, commits, and archives the file.
################################################################################

# download and apply a patch from the dropbox folder, then archive it
function _patch_download_and_apply() {
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local archive_folder="${dropbox_folder}/archived_patch"

  mkdir -p "$archive_folder"

  # find most recently modified .patch file with content (cross-platform via node)
  local latest_patch
  latest_patch=$(
    _PATCH_ARG="$dropbox_folder" node << '_PATCH_FIND_EOF_'
    const fs=require('fs'),path=require('path'),dir=process.env._PATCH_ARG;
    const patches=fs.readdirSync(dir)
      .filter(f=>{
        if(!f.endsWith('.patch')||f.startsWith('._'))return false;
        const fp=path.join(dir,f),st=fs.statSync(fp);
        return st.isFile()&&st.size>0;
      })
      .map(f=>({p:path.join(dir,f),m:fs.statSync(path.join(dir,f)).mtimeMs}))
      .sort((a,b)=>b.m-a.m);
    if(patches.length)console.log(patches[0].p);
_PATCH_FIND_EOF_
  )

  echo "latest_patch: $latest_patch"

  if [ -z "$latest_patch" ]; then
    echo "No .patch files found in $dropbox_folder"
    return 1
  fi

  # extract decoded commit subject from the patch (handles MIME/RFC-2047 encoded headers)
  local commit_msg
  commit_msg=$(git mailinfo /dev/null /dev/null < "$latest_patch" | command grep "^Subject: " | sed 's/^Subject: //')
  commit_msg="${commit_msg:-applied patch}"

  echo "Applying: $latest_patch"
  echo "Message: $commit_msg"

  if git apply --reject --whitespace=fix "$latest_patch" && git add -A && git commit --allow-empty --no-verify -m "$commit_msg"; then
    git commit --amend --reset-author --no-verify
    mv "$latest_patch" "$archive_folder"
    echo "Successfully applied and archived."
  else
    echo "Error occurred during patching/committing. Patch was NOT moved to archive."
    return 1
  fi
}

# create a patch from the last commit, rename with repo-date prefix, and upload to dropbox
function _patch_create_and_upload() {
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  git patch-get

  # rename with mtime prefix and move to dest (cross-platform via node)
  # uses heredoc (single-quoted delimiter) to avoid bash expanding ! and $ inside the script
  _PATCH_ARG="$dropbox_folder" node << '_PATCH_UPLOAD_EOF_' || return 1
    const fs=require('fs'),path=require('path');
    const dest=process.env._PATCH_ARG,proj=path.basename(process.cwd());
    const patches=fs.readdirSync('.').filter(f=>f.endsWith('.patch')&&fs.statSync(f).isFile());
    if(!patches.length){console.log('No .patch files generated');process.exit(1);}
    for(const f of patches){
      const mtime=fs.statSync(f).mtime;
      const ts=mtime.getFullYear()+'_'+String(mtime.getMonth()+1).padStart(2,'0')+'_'+String(mtime.getDate()).padStart(2,'0')+'_'+String(mtime.getHours()).padStart(2,'0')+'_'+String(mtime.getMinutes()).padStart(2,'0');
      const newName=proj+'-'+ts+'-'+f;
      const target=path.join(dest,newName);try{fs.copyFileSync(f,target);}catch{fs.writeFileSync(target,fs.readFileSync(f));}fs.unlinkSync(f);
      console.log('Moved: '+newName);
    }
_PATCH_UPLOAD_EOF_

  type -P dot_clean &> /dev/null && dot_clean "${dropbox_folder}" &> /dev/null &
  open "${dropbox_folder}" &> /dev/null &
  echo "${dropbox_folder}"
}

# copy the last commit's patch to clipboard
function _patch_view_copy() {
  clear
  git patch-view | copy
}

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

alias patch0='_patch_create_and_upload'
alias patch1='_patch_view_copy'
alias patch2='_patch_download_and_apply'
alias patch_apply='_patch_download_and_apply'
alias dpatch='_patch_download_and_apply'

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
