#!/usr/bin/env bash

################################################################################
# ---- File Utilities ----
#
# --- Simple Utilities (no dependencies) ---
# download — Download a file from a URL via curl
# tree     — Display directory tree (falls back to find+sed)
# cp2      — Copy with progress bar via pv (supports file->file)
# watch    — Run a command when files change (md5-based polling)
#
# --- Copy Chain (dependency order: base -> helpers -> consumers) ---
# _cp_node_helpers — [internal] Shared Node.js helpers piped into node heredocs
# cpsync  — Base copy: file->folder or folder->folder (recursive). Skips
#            unchanged files by size (binary) or size+wordcount+age (text).
#            Progress, ETA, cross-device safe.
# cpstamp — Copy a file with a timestamp suffix. Delegates to cpsync.
# cprepo  — Non-git: passes folder to _cp_zip_to_dest (zips everything).
#            Git: syncs repo, writes tracked file list, passes to _cp_zip_to_dest.
# cpfiles — Node writes glob-matched file list, passes to _cp_zip_to_dest.
# cpenv   — Shorthand for cpfiles with ".env*" pattern
# cpdb    — Shorthand for cpfiles with "*.sqlite*" pattern
#
# --- File Operations ---
# dedup   — Scan for duplicates by MD5+size, move extras to _recycleBin.
#
# --- Text Pack/Unpack (bulletproof) ---
# pack_text      — Bundle every file in a directory as gzip+base64 blocks with
#                  file-mode markers under PACK_BEGIN/PACK_END. Round-trips
#                  byte-exact regardless of file content (text or binary).
#                  Default mode is --raw (auto-saved to /tmp/<flat>.<ts>.pack.txt
#                  and streamed to stdout). --zip / --tar wrap the same blob.
#                  In a git repo, starts from `git ls-files` plus untracked
#                  extras (.env*, .bash*, .zsh*, .md, .xml, .src, .sh, .sql,
#                  .db, .sqlite*, .yml/.yaml, .json, .toml, .ini, .conf, .cfg).
#                  All paths flow through `filter_unwanted` so excluded folders
#                  (node_modules, .venv, __pycache__, .build, etc.) are pulled
#                  from the centralized EDITOR_CONFIGS.ignoredFoldersRegex set.
# unpack_text    — Extract files from a pack (file path, archive, '-' stdin
#                  marker, or piped stdin). Dispatches per-block on the
#                  encoding token: gzip+base64 → decode + write bytes; no
#                  encoding → write content verbatim. Restores file mode via
#                  fs.chmodSync (noop on Windows).
# view_pack_text — Re-emit a pack with text-content blocks decoded inline as
#                  raw text (binary blocks stay encoded). Output is itself a
#                  valid pack — greppable / diffable / re-feedable into
#                  unpack_text.
#
# Node.js logic runs via inline heredocs. Bash wrappers handle arg
# validation and defaults, then pipe shared helpers + function code into node.
################################################################################

################################################################################
# ---- Simple Utilities ----
################################################################################
# download: download a file from a URL via curl
function download() {
  local url="$1"
  local dest="${2:-.}"

  if [ -z "$url" ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "download: download a file from a URL via curl
  Usage: download <url> [dest_path_or_dir]"
    return 1
  fi

  local filename
  filename=$(basename "$url")

  if [ -d "$dest" ]; then
    # dest is an existing directory — download into it
    command curl -fsSL -o "${dest%/}/${filename}" "$url"
  elif [ -d "$(dirname "$dest")" ]; then
    # dest looks like a file path — download and rename
    command curl -fsSL -o "$dest" "$url"
  else
    echo "download: destination directory does not exist: $(dirname "$dest")"
    return 1
  fi
}

# tree: display directory tree (falls back to find+sed when tree is not installed)
function tree() {
  if type -P tree &> /dev/null; then
    command tree "$@"
  else
    command find . -type d | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/"
  fi
}

# cp2: copy a single file with progress bar via pv (supports file->file)
function cp2() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cp2: copy with progress bar via pv
  Usage: cp2 <src> <dest>"
    return
  fi
  echo "==== copy ===="
  echo "src: $1"
  echo "dest: $2"
  pv "$1" > "$2"
}

# watch: run a command when files change (polls with md5, checks every 2s)
function watch() {
  local dir="${1:-.}"
  local filter="${2:-*}"
  local cmd="$3"
  local chsum1="" chsum2=""

  if [ -z "$cmd" ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "watch: run a command when files change
  Usage: watch <dir> <filter> <command>
  Example: watch src '*.js' 'npm test'"
    return 1
  fi

  # use md5sum on linux, md5 on mac
  local md5cmd="md5sum"
  type -P md5sum &> /dev/null || md5cmd="md5"

  while true; do
    chsum2=$(find -L "$dir" -type f -name "$filter" -exec $md5cmd {} \; 2> /dev/null)
    if [ "$chsum1" != "$chsum2" ]; then
      [ -n "$chsum1" ] && echo "File change detected, running: $cmd"
      eval "$cmd"
      chsum1="$chsum2"
    fi
    sleep 2
  done
}

################################################################################
# ---- Copy Chain: Internal Helpers ----
################################################################################
# _cp_node_helpers: prints shared Node.js helper functions to stdout for piping to node.
# Used by cpsync, cpfiles, and dedup. Each pipes this + its own logic into a single node process.
function _cp_node_helpers() {
  command cat << '_HELPERS_EOF'
/** Shared helpers for cp utility functions. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/** Formats byte count as human-readable string (e.g., 1.2GB, 45.3MB, 8.5KB). Returns 'N/A' for negative values. */
function fmtBytes(bytes) {
  if (bytes < 0) return 'N/A';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + 'GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

/** Formats seconds as HH:MM:SS or MM:SS. */
function fmtDuration(secs) {
  const s = Math.floor(secs);
  if (s >= 3600) return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
  return [Math.floor(s / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
}

/** Formats a timestamp string as YYYY_MM_DD_HH_MM for file naming. */
function fmtTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '_' + pad(d.getMonth() + 1) + '_' + pad(d.getDate()) + '_' + pad(d.getHours()) + '_' + pad(d.getMinutes());
}

/** Formats current datetime as YYYY-MM-DD HH:MM:SS in local time. */
function fmtNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

/** Collects files from a directory, optionally recursing. Skips .DS_Store and .git. */
function collectFiles(dir, recurse) {
  let files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || entry.name === '.git') continue;
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory() && recurse) files = files.concat(collectFiles(fp, true));
      else if (entry.isFile()) files.push(fp);
    }
  } catch {}
  return files.sort();
}

/** Returns total byte size of all files under a directory (recursive). Skips scan when file count exceeds cap (returns -1). */
const DIR_TOTAL_SIZE_CAP = 500;
function dirTotalSize(dir) {
  const files = collectFiles(dir, true);
  if (files.length > DIR_TOTAL_SIZE_CAP) return -1;
  let total = 0;
  for (const f of files) try { total += fs.statSync(f).size; } catch {}
  return total;
}

/** Extensions for binary/media files where word counting is meaningless. */
const BINARY_EXTS = new Set([
  '.png','.jpg','.jpeg','.gif','.bmp','.webp','.tiff','.ico','.svg',
  '.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm',
  '.mp3','.wav','.flac','.aac','.ogg','.wma',
  '.zip','.tar','.gz','.bz2','.xz','.7z','.rar','.dmg','.iso',
  '.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx',
  '.exe','.dll','.so','.dylib','.bin','.dat','.db','.sqlite',
]);

/** Counts whitespace-separated words in a file (equivalent to wc -w). Skips binary files and files over 2MB. */
function wordCount(fp) {
  if (BINARY_EXTS.has(path.extname(fp).toLowerCase())) return 0;
  try { if (fs.statSync(fp).size > 2 * 1048576) return 0; } catch { return 0; }
  try { return fs.readFileSync(fp, 'utf8').split(/\s+/).filter(Boolean).length; } catch { return 0; }
}

/** Checks if a string value represents truthy (true/1). */
function isTruthy(val) { return val === 'true' || val === '1'; }

/** Copies a file with read+write fallback. copyFileSync uses FICLONE/copy_file_range which fails with EPERM on cross-device/network (SMB) mounts. */
function safeCopyFile(src, dest) { try { fs.copyFileSync(src, dest); } catch { fs.writeFileSync(dest, fs.readFileSync(src)); } }

const LINE_BREAK = '#'.repeat(80);
_HELPERS_EOF
}

################################################################################
# ---- Copy Chain: Base ----
################################################################################
# cpsync: smart copy file->folder or folder->folder (recursive), with progress, ETA,
# skip-if-unchanged (by size for binary, size+wordcount+age for text), cross-device safe
function cpsync() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpsync: smart file/dir copy with progress, ETA, and skip-if-unchanged
  Usage: cpsync <src> <dest> [lookback_days=7] [max_size_gb=1]
  Modes:
    cpsync file.txt /backup/       file -> folder (keeps filename)
    cpsync /photos/ /backup/       folder -> folder (recursive, preserves structure)
  dest is always a folder (created if missing). src file -> dest file rename is not supported.
  Skip logic:
    binary files (images, video, archives, etc.): skip if same file size
    text files: skip if same size + word count and older than lookback_days
  Options:
    lookback_days  re-copy threshold for text files (default 7, ignored for binary)
    max_size_gb    abort if total source size exceeds this (default 1, max 100)"
    return
  fi
  local src="${1:?Usage: cpsync <src> <dest> [lookback_days=7] [max_size_gb=1]}"
  local dest="${2:?Usage: cpsync <src> <dest> [lookback_days=7] [max_size_gb=1]}"
  local lookback_days="${3:-7}"
  local max_size_gb="${4:-1}"
  if [ "$max_size_gb" -gt 100 ]; then
    echo "cpsync: max_size_gb cannot exceed 100GB"
    return 1
  fi
  {
    _cp_node_helpers
    command cat << 'CPSYNC_NODE'
/** Smart file/dir copy with progress, ETA, and skip-if-unchanged logic. */
const src = process.env.CPSYNC_SRC;
const dest = process.env.CPSYNC_DEST;
const lookbackDays = parseInt(process.env.CPSYNC_LOOKBACK, 10);
const lookbackSecs = lookbackDays * 86400;
const maxSizeGb = parseInt(process.env.CPSYNC_MAXGB, 10);
const maxBytes = maxSizeGb * 1073741824;

if (!fs.existsSync(src)) { console.log('cpsync: source not found: ' + src); process.exit(1); }
if (fs.existsSync(dest) && !fs.statSync(dest).isDirectory()) { console.log('cpsync: dest must be a directory: ' + dest); process.exit(1); }

let files;
let isDir = false;
const srcStat = fs.statSync(src);
if (srcStat.isDirectory()) { isDir = true; files = collectFiles(src, true); }
else { files = [src]; }

const total = files.length;
if (total === 0) { console.log('cpsync: no files found in ' + src); process.exit(0); }

let prescanBytes = 0;
for (const f of files) try { prescanBytes += fs.statSync(f).size; } catch {}
if (prescanBytes > maxBytes) {
  console.log('cpsync: total size ' + fmtBytes(prescanBytes) + ' exceeds ' + maxSizeGb + 'GB limit, aborting');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

let copied = 0, skipped = 0, failed = 0, copiedBytes = 0, skippedBytes = 0, totalBytes = 0;
const startTime = Date.now() / 1000;

console.log('cpsync: ' + src + ' -> ' + dest);
console.log('  ' + total + ' files, skip if unchanged for ' + lookbackDays + ' days, Max: ' + maxSizeGb + 'GB');
console.log('  Source size: ' + fmtBytes(prescanBytes) + ', scanning dest...');

const destBeforeBytes = dirTotalSize(dest);
console.log('  Dest size: ' + fmtBytes(destBeforeBytes));
console.log('  Started at ' + fmtNow());
console.log(LINE_BREAK);

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const idx = i + 1;
  const remaining = total - idx;
  const pct = Math.floor(idx * 100 / total);

  let destFile;
  if (isDir) {
    const rel = file.slice(src.length).replace(/^\//, '');
    destFile = path.join(dest, rel);
  } else {
    destFile = path.join(dest, path.basename(file));
  }

  let srcSize = 0;
  try { srcSize = fs.statSync(file).size; } catch {}
  const srcWc = wordCount(file);
  totalBytes += srcSize;

  const now = Date.now() / 1000;
  const elapsed = now - startTime;
  let etaStr = '--:--';
  if (i > 0 && elapsed > 0) etaStr = fmtDuration(Math.floor(elapsed / i * remaining));

  let skip = false;
  try {
    const ds = fs.statSync(destFile);
    if (ds.isFile() && srcSize === ds.size) {
      // same size: skip binary files immediately, skip text files if word count matches
      // lookback only forces re-copy for text files modified within the lookback window
      const destWc = wordCount(destFile);
      const modAge = Math.floor(now) - Math.floor(fs.statSync(file).mtimeMs / 1000);
      if (srcWc === 0 && destWc === 0) skip = true;
      else if (srcWc === destWc && modAge > lookbackSecs) skip = true;
    }
  } catch {}

  const prefix = '[' + idx + '/' + total + ' ' + pct + '% ETA:' + etaStr + ']';
  const sizeStr = fmtBytes(srcSize);
  const wcStr = srcWc > 0 ? ', ' + srcWc + 'w' : '';

  if (skip) {
    skipped++;
    skippedBytes += srcSize;
    console.log(prefix + ' SKIP ' + file + ' (' + sizeStr + wcStr + ') -> Skipped');
  } else {
    try {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      safeCopyFile(file, destFile);
      copied++;
      copiedBytes += srcSize;
      console.log(prefix + ' COPY ' + file + ' -> ' + destFile + ' (' + sizeStr + wcStr + ') -> Copied');
    } catch (e) {
      failed++;
      console.log(prefix + ' FAIL ' + file + ' -> Failed: ' + e.message);
    }
  }
}

const duration = Math.floor(Date.now() / 1000 - startTime);
const destAfterBytes = dirTotalSize(dest);

console.log(LINE_BREAK);
console.log('Done in ' + fmtDuration(duration));
console.log('  Copied:  ' + copied + ' files (' + fmtBytes(copiedBytes) + ')');
console.log('  Skipped: ' + skipped + ' files (' + fmtBytes(skippedBytes) + ')');
if (failed > 0) console.log('  Failed:  ' + failed + ' files');
console.log('  Total:   ' + total + ' files (' + fmtBytes(totalBytes) + ')');
console.log('  Dest:    ' + fmtBytes(destBeforeBytes) + ' -> ' + fmtBytes(destAfterBytes));
console.log('  Finished at ' + fmtNow());
CPSYNC_NODE
  } | CPSYNC_SRC="$src" CPSYNC_DEST="$dest" CPSYNC_LOOKBACK="$lookback_days" CPSYNC_MAXGB="$max_size_gb" node
}

# _cp_zip_to_dest: zip files and copy the .zip to dest via cpsync, then clean up all tmp files
function _cp_zip_to_dest() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "_cp_zip_to_dest: zip files and copy .zip to dest via cpsync
  Usage: _cp_zip_to_dest <folder_or_file_list> <dest> [zip_name] [max_size_gb=1] [should_add_time_stamp=false]
  Folder mode:    _cp_zip_to_dest ~/Documents /backup
  File list mode: _cp_zip_to_dest /tmp/myfiles.list /backup \"myzip\"
  Folder mode zips everything recursively.
  File list mode reads absolute paths (one per line) from the temp file, zips those, deletes the temp file.
  Both modes: create zip, check size limit, copy via cpsync, clean up."
    return
  fi
  local src="$1"
  local dest="$2"
  if [ -z "$src" ] || [ -z "$dest" ]; then
    _cp_zip_to_dest --help
    return 1
  fi
  local zip_name="${3:-}"
  local max_size_gb="${4:-1}"
  local should_add_time_stamp="${5:-false}"

  local zip_root=""
  local file_list=""

  if [ -d "$src" ]; then
    # src is a folder — zip everything in it
    zip_root=$(cd "$src" && command pwd)
  elif [ -f "$src" ]; then
    # src is a file list with absolute paths — derive zip root from the paths
    file_list="$src"
    zip_root=$(dirname "$(head -1 "$file_list")")
    # walk up to the common ancestor of all paths
    while IFS= read -r _f; do
      while [[ "$_f" != "$zip_root/"* ]] && [ "$zip_root" != "/" ]; do
        zip_root=$(dirname "$zip_root")
      done
    done < "$file_list"
  else
    echo "_cp_zip_to_dest: not found: $src"
    return 1
  fi

  # generate zip name from the zip root if not provided
  if [ -z "$zip_name" ]; then
    zip_name="${zip_root#/}"
    zip_name="${zip_name//\//-}"
  fi
  is_truthy "$should_add_time_stamp" && zip_name="${zip_name}_$(command date +%Y_%m_%d_%H_%M)"
  local tmp_zip="/tmp/${zip_name}.zip"
  rm -f "$tmp_zip"

  # create zip: from file list (selective) or entire folder (recursive)
  if [ -n "$file_list" ]; then
    # convert absolute paths to relative (strip zip_root prefix) and zip
    sed "s|^${zip_root}/|./|" "$file_list" | (cd "$zip_root" && zip -q "$tmp_zip" -@) || {
      echo "_cp_zip_to_dest: failed to create zip from file list"
      rm -f "$file_list"
      return 1
    }
    rm -f "$file_list"
  else
    (cd "$zip_root" && zip -q -r "$tmp_zip" .)
    local _zip_rc=$?
    # zip exit 18 = "some files could not be read" (sockets, broken symlinks, etc.) — treat as success
    if [ "$_zip_rc" -ne 0 ] && [ "$_zip_rc" -ne 18 ]; then
      echo "_cp_zip_to_dest: failed to create zip"
      return 1
    fi
  fi

  if [ ! -f "$tmp_zip" ]; then
    echo "_cp_zip_to_dest: zip not found: $tmp_zip"
    return 1
  fi

  # check size limit
  local zip_size
  zip_size=$(stat -f%z "$tmp_zip" 2> /dev/null || stat -c%s "$tmp_zip" 2> /dev/null)
  local max_bytes=$((max_size_gb * 1073741824))
  if [ "$zip_size" -gt "$max_bytes" ]; then
    echo "_cp_zip_to_dest: zip size exceeds ${max_size_gb}GB limit, aborting"
    rm -f "$tmp_zip"
    return 1
  fi

  # copy to dest via cpsync (handles skip-if-same-size, progress, cross-device)
  cpsync "$tmp_zip" "$dest"
  rm -f "$tmp_zip"
}

################################################################################
# ---- Copy Chain: Consumers ----
################################################################################
# cpstamp: copy a file with a timestamp suffix (e.g. file.txt.2026_04_13_19_15), delegates to cpsync
function cpstamp() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpstamp: copy a file with a timestamp suffix appended
  Usage: cpstamp <src_file> <dest_dir>
  Output: dest_dir/filename.2026_03_24_17_30"
    return
  fi
  local src="${1:?Usage: cpstamp <src_file> <dest_dir>}"
  local dest="${2:?Usage: cpstamp <src_file> <dest_dir>}"
  if [ ! -f "$src" ]; then
    echo "cpstamp: source file not found: $src"
    return 1
  fi
  local ts
  ts=$(command date +%Y_%m_%d_%H_%M)
  local stamped="/tmp/$(basename "$src").${ts}"
  cp "$src" "$stamped"
  cpsync "$stamped" "$dest"
  rm -f "$stamped"
}

# cprepo: zip a git repo or plain folder and copy the .zip to dest.
# Git repos: stash, checkout default branch, pull, clean, then write tracked file list
#   and pass it to _cp_zip_to_dest (only tracked files are zipped).
# Non-git folders: pass the folder to _cp_zip_to_dest (zips everything recursively).
function cprepo() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cprepo: zip a git repo (tracked files) or folder and copy .zip to dest
  Usage: cprepo <src_dir> <dest_dir> [max_size_gb=1] [should_add_time_stamp=false]
  For git repos: syncs to default branch, zips only tracked files.
  For non-git: zips entire folder recursively.
  should_add_time_stamp  if true/1, append timestamp to zip name"
    return
  fi
  local src="${1:?Usage: cprepo <src> <dest> [max_size_gb=1] [should_add_time_stamp=false]}"
  local dest="${2:?Usage: cprepo <src> <dest> [max_size_gb=1] [should_add_time_stamp=false]}"
  local max_size_gb="${3:-1}"
  if [ "$max_size_gb" -gt 1 ]; then
    echo "cprepo: max_size_gb cannot exceed 1GB"
    return 1
  fi
  local should_add_time_stamp="${4:-false}"

  if [ ! -d "$src" ]; then
    echo "cprepo: source directory not found: $src"
    return 1
  fi

  local abs_src
  abs_src=$(cd "$src" && command pwd)

  # non-git: list all files, filter out unwanted paths, zip the remainder
  if ! git -C "$abs_src" rev-parse --is-inside-work-tree &> /dev/null; then
    echo "cprepo: $abs_src -> $dest (not a git repo, zipping entire folder)"
    local file_list="/tmp/_cprepo_files_$$"
    (cd "$abs_src" && find . -type f | filter_unwanted | sed "s|^\./|${abs_src}/|") > "$file_list"
    if [ ! -s "$file_list" ]; then
      echo "cprepo: no files to zip after filtering"
      rm -f "$file_list"
      return 1
    fi
    _cp_zip_to_dest "$file_list" "$dest" "" "$max_size_gb" "$should_add_time_stamp"
    return
  fi

  # git: sync to default branch, write tracked file list (absolute paths) to temp file,
  # pass it to _cp_zip_to_dest which zips those files and copies to dest
  echo "cprepo: $abs_src -> $dest (git repo, syncing and zipping tracked files only)"
  local default_branch="main"
  default_branch=$(git -C "$abs_src" symbolic-ref refs/remotes/origin/HEAD 2> /dev/null | sed 's|refs/remotes/origin/||') || default_branch="main"
  git -C "$abs_src" stash &> /dev/null
  git -C "$abs_src" checkout "$default_branch" &> /dev/null
  GIT_TERMINAL_PROMPT=0 git -C "$abs_src" pull &> /dev/null || echo "  WARN: git pull skipped (credentials required or remote unavailable)"
  git -C "$abs_src" clean -fd &> /dev/null

  local file_list="/tmp/_cprepo_files_$$"
  (cd "$abs_src" && git ls-files | sed "s|^|${abs_src}/|") > "$file_list"
  _cp_zip_to_dest "$file_list" "$dest" "" "$max_size_gb" "$should_add_time_stamp"
}

# cpfiles: zip files matching a glob pattern and copy the .zip to dest.
# Node does the glob matching and writes matching file paths (absolute, one per line)
# to a temp file. _cp_zip_to_dest zips those files and copies to dest.
function cpfiles() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpfiles: zip files matching a glob pattern and copy .zip to dest
  Usage: cpfiles <src_dir> <dest_dir> <pattern> [should_add_time_stamp=false]
  pattern  glob (e.g., \".env*\", \"*.log\", \"*.conf\")
  should_add_time_stamp  if true/1, append timestamp to zip name
  Examples:
    cpfiles ~/myproject /backup \".env*\"
    cpfiles . /backup \"*.conf\" true"
    return
  fi
  local src="${1:?Usage: cpfiles <src> <dest> <pattern> [should_add_time_stamp=false]}"
  local dest="${2:?Usage: cpfiles <src> <dest> <pattern> [should_add_time_stamp=false]}"
  local pattern="${3:?Usage: cpfiles <src> <dest> <pattern> [should_add_time_stamp=false]}"
  local should_add_time_stamp="${4:-false}"

  if [ ! -d "$src" ]; then
    echo "cpfiles: source directory not found: $src"
    return 1
  fi

  local abs_src
  abs_src=$(cd "$src" && command pwd)

  # node does glob matching and writes absolute file paths (one per line) to a temp file
  local file_list="/tmp/_cpfiles_list_$$"
  {
    _cp_node_helpers
    command cat << 'CPFILES_NODE'
const absSrc = fs.realpathSync(process.env.CPFILES_SRC);
const pattern = process.env.CPFILES_PATTERN;

function matchGlob(name, pat) {
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return re.test(name);
}

const files = collectFiles(absSrc, true).filter(f => matchGlob(path.basename(f), pattern));
if (!files.length) { console.error("cpfiles: no files matching '" + pattern + "' in " + absSrc); process.exit(1); }

console.error('cpfiles: ' + absSrc + ' (pattern: ' + pattern + ', ' + files.length + ' files)');
for (const f of files) console.log(f);
CPFILES_NODE
  } | CPFILES_SRC="$abs_src" CPFILES_PATTERN="$pattern" node > "$file_list" || {
    rm -f "$file_list"
    return 1
  }

  # generate zip name: /Users/syle/git/myproject + ".env*" -> Users-syle-git-myproject_.env*
  # strip leading /, slashes become dashes, spaces become underscores, pattern appended after _
  local zip_name="${abs_src#/}"
  zip_name="${zip_name//\//-}_${pattern//\//-}"
  zip_name="${zip_name// /_}"

  _cp_zip_to_dest "$file_list" "$dest" "$zip_name" "1" "$should_add_time_stamp"
}

# cpenv: shorthand for cpfiles — zip all .env* files and copy .zip to dest
function cpenv() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpenv: zip all .env* files and copy .zip to dest (timestamp on by default)
  Usage: cpenv <src_dir> <dest_dir> [should_add_time_stamp=true]
  Shorthand for: cpfiles <src> <dest> \".env*\" [should_add_time_stamp]"
    return
  fi
  cpfiles "$1" "$2" ".env*" "${3:-true}"
}

# cpdb: shorthand for cpfiles — zip all *.sqlite* files and copy .zip to dest
function cpdb() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpdb: zip all *.sqlite* files and copy .zip to dest (timestamp on by default)
  Usage: cpdb <src_dir> <dest_dir> [should_add_time_stamp=true]
  Shorthand for: cpfiles <src> <dest> \"*.sqlite*\" [should_add_time_stamp]"
    return
  fi
  cpfiles "$1" "$2" "*.sqlite*" "${3:-true}"
}

################################################################################
# ---- File Operations ----
################################################################################
# dedup: scan a folder for duplicates (by MD5 hash + file size), move extras to _recycleBin keeping newest
function dedup() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "dedup: move duplicate files to _recycleBin, keeping the newest"
    echo "  dedup <path> [recursive=false] [across_folders=false]"
    echo "  recursive       if true/1, scan subdirectories recursively"
    echo "  across_folders  if true/1, deduplicate across all subdirectories globally"
    return
  fi
  local target="${1:?Usage: dedup <path> [recursive=false] [across_folders=false]}"
  local recursive="${2:-false}"
  local across_folders="${3:-false}"
  if [ ! -d "$target" ]; then
    echo "dedup: directory not found: $target"
    return 1
  fi
  local abs_target
  abs_target=$(cd "$target" && command pwd)
  {
    _cp_node_helpers
    command cat << 'DEDUP_NODE'
/** Moves duplicate files to a recycle bin, keeping the newest original. */
const targetDir = process.env.DEDUP_PATH;
const recursive = isTruthy(process.env.DEDUP_RECURSIVE);
const acrossFolders = isTruthy(process.env.DEDUP_ACROSS);
const recycleBin = path.join(targetDir, '_recycleBin');

const startTime = Date.now() / 1000;

console.log('dedup: ' + targetDir);
console.log('  Recursive: ' + recursive + ', Across folders: ' + acrossFolders);
console.log('  Recycle bin: ' + recycleBin);
console.log('  Started at ' + fmtNow());
console.log(LINE_BREAK);

const files = collectFiles(targetDir, recursive).filter(f => !f.startsWith(recycleBin + '/') && !f.startsWith(recycleBin + path.sep));
console.log('  ' + files.length + ' files to scan');

/** Groups files by comparison scope (global or per-directory). */
const groups = {};
for (const file of files) {
  const scope = acrossFolders ? '__global__' : path.dirname(file);
  if (!groups[scope]) groups[scope] = [];
  groups[scope].push(file);
}

let totalMoved = 0, totalFreed = 0, totalScanned = 0, totalDupSets = 0;

for (const [scope, scopeFiles] of Object.entries(groups)) {
  /** Hash map keyed by "md5:size" to group identical files. */
  const hashMap = {};
  for (const file of scopeFiles) {
    totalScanned++;
    try {
      const stat = fs.statSync(file);
      const hash = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
      const key = hash + ':' + stat.size;
      if (!hashMap[key]) hashMap[key] = [];
      hashMap[key].push({ path: file, mtime: stat.mtimeMs, size: stat.size });
    } catch (e) {
      console.log('  WARN: ' + file + ': ' + e.message);
    }
  }

  for (const dupes of Object.values(hashMap)) {
    if (dupes.length < 2) continue;
    totalDupSets++;
    dupes.sort((a, b) => b.mtime - a.mtime);
    const kept = dupes[0];
    console.log('  KEEP ' + kept.path + ' (' + fmtBytes(kept.size) + ')');
    for (let i = 1; i < dupes.length; i++) {
      const dup = dupes[i];
      const rel = dup.path.slice(targetDir.length).replace(/^\//, '');
      const destFile = path.join(recycleBin, rel);
      try {
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.renameSync(dup.path, destFile);
        totalMoved++;
        totalFreed += dup.size;
        console.log('  MOVE ' + dup.path + ' -> ' + destFile + ' (dup of ' + path.basename(kept.path) + ')');
      } catch (e) {
        console.log('  FAIL ' + dup.path + ': ' + e.message);
      }
    }
  }
}

console.log('  Scanned: ' + totalScanned + ' files');
console.log('  Duplicate sets: ' + totalDupSets);
console.log('  Moved: ' + totalMoved + ' files (' + fmtBytes(totalFreed) + ' freed)');
console.log('  Recycle bin: ' + recycleBin);

const duration = Math.floor(Date.now() / 1000 - startTime);
console.log(LINE_BREAK);
console.log('Done in ' + fmtDuration(duration));
console.log('  Finished at ' + fmtNow());
DEDUP_NODE
  } | DEDUP_PATH="$abs_target" DEDUP_RECURSIVE="$recursive" DEDUP_ACROSS="$across_folders" node
}

################################################################################
# ---- Text Pack/Unpack (bulletproof) ----
#
# pack_text / unpack_text / view_pack_text — bundle a directory into a single
# self-contained pack file (and back).
#
# Pack format (raw mode):
#   ===== PACK_BEGIN: <relative/path> [gzip+base64,mode=0NNN] =====
#   <base64 of gzipped file bytes>
#   ===== PACK_END: <relative/path> =====
#
# Every file (text or binary) is gzip+base64-encoded so the bundle round-trips
# byte-exact regardless of content. `mode=0NNN` records 0o777 chmod bits.
#
# Two bash entry points:
#   pack_text       — produce a pack from a directory.
#   unpack_text     — parse a pack and either extract files to disk (default)
#                     or re-emit it with text blocks decoded inline (--view).
#                     Accepts file path, '-' stdin marker, or piped stdin.
#                     Auto-detects .tar.gz/.zip/.tar archives in file mode.
#
# `view_pack_text` is just a thin alias around `unpack_text --view`. It exists
# so the user can grep/diff/edit a pack without unpacking files to disk —
# its output is itself a valid pack (text blocks lose the [gzip+base64] token
# and inline raw text; binary blocks pass through encoded). Re-feedable into
# unpack_text.
################################################################################

# _filter_pack_extras: stdin->stdout pipe filter that keeps only paths whose
# basename matches the pack_text "extras" set. These mirror the regex set
# documented in pack_text help: .env*, .bash*, .zsh*, .md, .xml, .src, .sh,
# .sql, .db, .sqlite*, .yml/.yaml, .json, .toml, .ini, .conf, .cfg. Used to
# narrow `git ls-files --others --exclude-standard` (untracked/gitignored)
# down to commonly-useful local files (.env.local, local rc files, sqlite
# DBs, config snippets) without sweeping in random untracked junk.
function _filter_pack_extras() {
  command awk -F/ '
    {
      base = tolower($NF)
      if (base ~ /^\.env($|\..+)|^\.bash|^\.zsh|\.(md|xml|src|sh|sql|db|ya?ml|json|toml|ini|conf|cfg)$|\.sqlite/) print
    }
  '
}

# pack_text: bundle every file in a directory as gzip+base64 blocks with file-mode
# markers. Default --raw mode auto-saves to /tmp/<flat>.<ts>.pack.txt AND streams
# the bundle to stdout (so `pack_text | unpack_text /tmp/copy` works without --raw).
# --zip and --tar wrap the same raw blob in compressed archives.
function pack_text() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "pack_text: bundle a directory (or a single file) into a self-contained pack
  Usage: pack_text [src=.] [output_file] [--raw|--zip|--tar] [--encode=<algo>] [--encode-level=N]
         src may be a directory (default behavior) OR a single file path
         (including hidden dotfiles) — in single-file mode the file is packed
         verbatim with no ignore filtering.
  Default mode: --raw with --encode=brotli (level 6)
                Output: /tmp/<host>.<flat>.<ts>.pack.txt (and streamed to stdout)
  Modes (outer container — orthogonal to --encode):
    --raw   [default] every file becomes a [<encoding>+base64,mode=0NNN] block between
                      ===== PACK_BEGIN: <path> ===== / ===== PACK_END: <path> =====
                      auto-named /tmp/<host>.<flat>.<ts>.pack.txt when no output_file
                      AND no explicit --raw flag. With explicit --raw and no
                      output_file, writes to stdout only (legacy pipe shortcut).
                      The saved file is always also cat'd to stdout, so
                      'pack_text | unpack_text /tmp/copy' works as a pipe.
    --zip             wraps the raw blob in a .zip archive
                      auto-named /tmp/<host>.<flat>.<ts>.pack.zip when output_file omitted
    --tar             wraps the raw blob in a .tar.gz archive
                      auto-named /tmp/<host>.<flat>.<ts>.pack.tar.gz when output_file omitted
  Encoding (inner per-block compression — orthogonal to --raw/--zip/--tar):
    --encode=<algo>          gzip | brotli (default: brotli — better ratio for text/configs)
    --encode-level=N         compression level / quality. Range depends on encoding:
                                gzip:   0-9   (default 6 = Z_DEFAULT_COMPRESSION)
                                brotli: 0-11  (default 6 = balanced)
                             Out-of-range or non-integer values error out.
                             unpack_text / view_pack_text auto-detect the encoding
                             from the per-block PACK_BEGIN token, so a single
                             pack may legally mix gzip and brotli blocks.
  File selection (directory mode):
    git repo  - git ls-files (tracked) + any untracked extras in the working
                tree (.env*, .bash*, .zsh*, .md, .xml, .src, .sh, .sql, .db,
                .sqlite*, .yml/.yaml, .json, .toml, .ini, .conf, .cfg).
    non-git   - recursive walk via find (node_modules / .git pruned for perf).
    Both modes are then piped through filter_unwanted, which applies the
    centralized EDITOR_CONFIGS.ignoredFoldersRegex set (node_modules, .venv,
    __pycache__, .build, .next, .nuxt, /dist/, /build/, /coverage/, etc.).
  File selection (single-file mode):
    The named file is packed unconditionally — ignore filters are bypassed
    so explicitly-named files (including hidden dotfiles) always pack.
  Encoding details:
    Every file (text or binary) is compressed (gzip or brotli) then base64-encoded
    so the bundle round-trips byte-exact regardless of file content. File mode
    bits (0o777, the chmod permissions) are recorded and restored by unpack_text.
  Provenance:
    Auto-generated output filenames lead with a sanitized hostname so `ls`
    groups backups by machine: <host>.<stem>.pack.txt / .zip / .tar.gz where
    <stem> = <flat-source-path>.<timestamp>. The host is sourced
    from \$HOSTNAME (fallback: hostname -s, then hostname). Sanitization:
    lowercase, every non-alphanum -> '_', repeated '_' collapsed to one,
    edges trimmed. A single META_DATA banner is emitted at the top of every
    pack: '===== META_DATA: host=<raw> packed_utc=<iso> source=<abs> file_count=<N> encoding=<algo> ====='
    unpack_text strips it as noise; view_pack_text preserves it.
    Explicit output_file arguments are NOT renamed.
  Examples:
    pack_text                                       # cwd, brotli (default) -> /tmp/<host>.<flat>.<ts>.pack.txt
    pack_text ~/project                             # project, brotli -> /tmp/<host>.<flat>.<ts>.pack.txt
    pack_text ~/.bashrc                             # single hidden file
    pack_text . output.txt                          # explicit output
    pack_text . --encode=gzip                       # gzip blocks (e.g. broader-compat backups)
    pack_text . --encode=brotli --encode-level=11   # brotli max compression (slow)
    pack_text . --encode=gzip   --encode-level=9    # gzip   max compression
    pack_text . --encode=brotli --tar               # brotli blocks inside .tar.gz outer
    pack_text | unpack_text /tmp/copy               # full pipe: pack -> unpack
    pack_text | view_pack_text                      # human-readable view (text decoded inline)
    pack_text . --raw                               # explicit --raw, stdout only
    pack_text . --zip                               # -> /tmp/<host>.<flat>.<ts>.pack.zip
    pack_text . --tar                               # -> /tmp/<host>.<flat>.<ts>.pack.tar.gz"
    return
  fi

  # Default packaging mode. mode_explicit tracks whether a flag was passed so we
  # can preserve the legacy "--raw with no output_file -> stdout only" shortcut
  # while bare default-raw still writes a file (no accidental terminal spam).
  #
  # `mode` controls the OUTER container (raw text / zip / tar.gz).
  # `pack_encoding` controls the INNER per-block compression (gzip / brotli).
  # The two are orthogonal — every combination is valid (e.g. brotli blocks
  # inside a .tar.gz outer). brotli is the default since this tool is mainly
  # used for text-heavy config backups, where brotli's ratio wins clearly.
  local mode="raw"
  local mode_explicit=0
  local pack_encoding="brotli"
  local pack_encode_level=""  # empty -> use per-encoding default (gzip 6, brotli 6)
  local positional=()
  for arg in "$@"; do
    case "$arg" in
    --raw | --plain)
      mode="raw"
      mode_explicit=1
      ;;
    --zip)
      mode="zip"
      mode_explicit=1
      ;;
    --tar)
      mode="tar"
      mode_explicit=1
      ;;
    --encode=*)
      pack_encoding="${arg#--encode=}"
      ;;
    --encode-level=*)
      pack_encode_level="${arg#--encode-level=}"
      ;;
    *) positional+=("$arg") ;;
    esac
  done

  # Validate --encode= up-front. Only gzip / brotli supported today; reject
  # everything else with a clear list so typos surface fast.
  case "$pack_encoding" in
  gzip | brotli) ;;
  *)
    echo "pack_text: unknown encoding: $pack_encoding (allowed: gzip, brotli)" >&2
    return 1
    ;;
  esac

  # Validate --encode-level= against the active encoding's range.
  #   gzip:   0-9  (zlib levels; 6 is Z_DEFAULT_COMPRESSION)
  #   brotli: 0-11 (brotli quality; 6 is our balance default)
  # Empty string means "use the per-encoding default" — handled in node.
  if [ -n "$pack_encode_level" ]; then
    if ! [[ "$pack_encode_level" =~ ^[0-9]+$ ]]; then
      echo "pack_text: --encode-level must be an integer (got: $pack_encode_level)" >&2
      return 1
    fi
    local _max_level
    case "$pack_encoding" in
    gzip) _max_level=9 ;;
    brotli) _max_level=11 ;;
    esac
    if [ "$pack_encode_level" -gt "$_max_level" ]; then
      echo "pack_text: --encode-level=$pack_encode_level invalid for $pack_encoding (allowed: 0-$_max_level)" >&2
      return 1
    fi
  fi

  local src="${positional[0]:-.}"
  local output="${positional[1]:-}"

  # Single-file mode: when src is a regular file (e.g. a hidden dotfile), pack
  # just that file with no ignore filtering — the user named it explicitly so
  # any .git / node_modules / EDITOR_CONFIGS exclusions should NOT apply. The
  # directory-mode filters (filter_unwanted, _filter_pack_extras) still run
  # for the normal directory case below.
  local single_file=0
  local single_file_basename=""
  if [ -f "$src" ]; then
    single_file=1
  elif [ ! -d "$src" ]; then
    echo "pack_text: path not found: $src" >&2
    return 1
  fi

  local abs_src
  if ((single_file)); then
    local src_dir src_base
    src_dir=$(command dirname "$src")
    src_base=$(command basename "$src")
    abs_src=$(cd "$src_dir" && command pwd)
    single_file_basename="$src_base"
  else
    abs_src=$(cd "$src" && command pwd)
  fi
  # Build a flattened, unique output stem from the source path: strip leading
  # '/', swap path separators with '_', append YYYY_MM_DD_HH_MM_SS so two
  # consecutive packs of the same project never overwrite each other.
  # Example: /Users/syle/git/bashrc -> Users_syle_git_bashrc.2026_04_24_22_45_30
  # In single-file mode, include the basename so the stem identifies the file.
  local flat_path
  if ((single_file)); then
    flat_path="${abs_src#/}/${single_file_basename}"
  else
    flat_path="${abs_src#/}"
  fi
  flat_path="${flat_path//\//_}"
  flat_path="${flat_path//\\/_}"
  [ -z "$flat_path" ] && flat_path="root"
  local pack_ts
  pack_ts=$(command date +%Y_%m_%d_%H_%M_%S)
  local auto_stem="${flat_path}.${pack_ts}"

  # Hostname detection — prefer $HOSTNAME (bash builtin, set on macOS / Linux /
  # WSL / Termux without a syscall), fall back to `hostname -s` then `hostname`,
  # then "unknown". Two forms are kept:
  #   pack_host_raw       — readable form for the META_DATA banner ("MyMac.local")
  #   pack_host_sanitized — filename-safe ("mymac_local"): lowercase, every
  #                          non-alphanum -> '_', runs of '_' collapsed, edges
  #                          stripped. Per the spec: replace non-alphanumeric
  #                          with '_', then collapse '__+' -> '_'.
  local pack_host_raw="${HOSTNAME:-}"
  [ -z "$pack_host_raw" ] && pack_host_raw=$(command hostname -s 2> /dev/null || true)
  [ -z "$pack_host_raw" ] && pack_host_raw=$(command hostname 2> /dev/null || true)
  [ -z "$pack_host_raw" ] && pack_host_raw="unknown"
  local pack_host_sanitized
  pack_host_sanitized=$(printf '%s' "$pack_host_raw" | command tr '[:upper:]' '[:lower:]' | command sed 's/[^a-z0-9]/_/g; s/__*/_/g; s/^_//; s/_*$//')
  [ -z "$pack_host_sanitized" ] && pack_host_sanitized="unknown"

  if [ -n "$output" ] && [[ "$output" != /* ]]; then
    output="$(command pwd)/$output"
  fi

  # Auto-generate output path if not specified.
  #   tar/zip   -> always auto-file
  #   raw       -> auto-file ONLY when --raw was not passed explicitly. Explicit
  #                --raw without output_file keeps the legacy stdout-only
  #                behavior so `pack_text ... --raw | unpack_text` still works.
  # Naming layout: <host>.<stem>.pack.<ext> — host first so `ls /tmp/*.pack.*`
  # groups all backups by machine, with stem (path + timestamp) ending in
  # ".pack.<ext>". Explicit output_file paths are NOT mutated.
  if [ -z "$output" ]; then
    case "$mode" in
    tar) output="/tmp/${pack_host_sanitized}.${auto_stem}.pack.tar.gz" ;;
    zip) output="/tmp/${pack_host_sanitized}.${auto_stem}.pack.zip" ;;
    raw) ((mode_explicit)) || output="/tmp/${pack_host_sanitized}.${auto_stem}.pack.txt" ;;
    esac
  fi

  local content_name="${auto_stem}.pack.txt"
  local tmp_packed="/tmp/${content_name}"
  rm -f "$tmp_packed"

  # Step 1: collect candidate file list in bash (relative paths, one per line).
  # Git mode emits tracked files plus the extras subset of untracked/gitignored
  # files (basename regex via _filter_pack_extras). Non-git mode walks via find,
  # pruning node_modules/.git for perf — filter_unwanted catches everything else.
  # The combined stream is piped through filter_unwanted to apply the central
  # EDITOR_CONFIGS.ignoredFoldersRegex set so excludes stay in one place.
  local file_list
  file_list="/tmp/_pack_text_files_${$}_${RANDOM}"
  rm -f "$file_list"
  local is_git=0
  local tracked_count=0 extras_count=0
  if ((single_file)); then
    # Single-file mode: skip git scan and find walk entirely. The basename
    # is written verbatim — no filter_unwanted, so explicitly-named files
    # (e.g. hidden dotfiles like .env) always pack regardless of ignore patterns.
    printf '%s\n' "$single_file_basename" > "$file_list"
    echo "pack_text: single file — $abs_src/$single_file_basename" >&2
  elif git -C "$abs_src" rev-parse --is-inside-work-tree &> /dev/null; then
    is_git=1
    local tracked_tmp extras_tmp
    tracked_tmp="${file_list}.tracked"
    extras_tmp="${file_list}.extras"
    (cd "$abs_src" && git ls-files) | filter_unwanted > "$tracked_tmp"
    # `git ls-files --others` (no --exclude-standard) lists ALL untracked
    # files including gitignored ones — important so a gitignored .env or
    # local .sqlite gets packed when its basename matches the extras set.
    (cd "$abs_src" && git ls-files --others) | _filter_pack_extras | filter_unwanted > "$extras_tmp"
    tracked_count=$(command wc -l < "$tracked_tmp" | command tr -d ' ')
    extras_count=$(command wc -l < "$extras_tmp" | command tr -d ' ')
    command cat "$tracked_tmp" "$extras_tmp" | command sort -u > "$file_list"
    rm -f "$tracked_tmp" "$extras_tmp"
    echo "pack_text: git repo — $tracked_count tracked + $extras_count extra (.env*/.bash*/.zsh*/.md/.xml/.src/.sh/.sql/.db/.sqlite*/.yml/.json/.toml/.ini/.conf/.cfg)" >&2
  else
    (cd "$abs_src" && command find . \( -name node_modules -o -name .git \) -prune -o -type f -print | command sed 's|^\./||') | filter_unwanted | command sort -u > "$file_list"
  fi

  if [ ! -s "$file_list" ]; then
    echo "pack_text: no files found in $abs_src" >&2
    rm -f "$file_list"
    return 1
  fi

  # Step 2: node reads the pre-filtered list and encodes each file. Node does
  # only the encoding; all file selection / exclusion lives in bash above.
  {
    command cat << 'PACK_TEXT_NODE'
/** Encodes each file in PACK_LIST as a [<encoding>+base64,mode=0NNN] block. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const srcDir = fs.realpathSync(process.env.PACK_SRC);
const listFile = process.env.PACK_LIST;
const outputFile = process.env.PACK_OUTPUT;
const metaHost = process.env.PACK_META_HOST || 'unknown';
const encoding = process.env.PACK_ENCODING || 'brotli';
// Per-encoding defaults: 6 is Z_DEFAULT_COMPRESSION for gzip, and brotli's
// "balanced" quality (a good speed/ratio knee — q11 is ~10x slower for ~3% gain).
const DEFAULT_LEVEL = { gzip: 6, brotli: 6 };
const encodeLevel = process.env.PACK_ENCODE_LEVEL
  ? parseInt(process.env.PACK_ENCODE_LEVEL, 10)
  : DEFAULT_LEVEL[encoding];

// Brotli was added in Node 11.7. If the user explicitly opts into it on an
// older runtime we fail fast with an actionable error rather than silently
// falling back — surprise-fallback would mask the version skew.
if (encoding === 'brotli' && typeof zlib.brotliCompressSync !== 'function') {
  console.error('pack_text: brotli requires Node >= 11.7; pass --encode=gzip');
  process.exit(1);
}

/** Compress a buffer using the active encoding + level. The compressed bytes
 *  are then base64-encoded line-wrapped at 76 chars (diff-friendly; whitespace
 *  is stripped at decode time). The emitted token in PACK_BEGIN tells the
 *  unpacker which decompressor to use, so per-block dispatch works even when
 *  a pack mixes encodings (e.g. legacy gzip blocks alongside fresh brotli). */
function compress(buf) {
  if (encoding === 'gzip') return zlib.gzipSync(buf, { level: encodeLevel });
  return zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: encodeLevel },
  });
}

function encodeFileBody(buf) {
  const b64 = compress(buf).toString('base64');
  return b64.replace(/(.{76})/g, '$1\n') + (b64.length % 76 === 0 ? '' : '\n');
}

const rels = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean);
let output = '';
let count = 0;
for (const rel of rels) {
  const file = path.join(srcDir, rel);
  try {
    const buf = fs.readFileSync(file);
    const stat = fs.statSync(file);
    if (!stat.isFile()) continue;
    const mode = (stat.mode & 0o777).toString(8).padStart(4, '0');  // padStart supplies the leading 0
    output += '===== PACK_BEGIN: ' + rel + ' [' + encoding + '+base64,mode=' + mode + '] =====\n';
    output += encodeFileBody(buf);
    output += '===== PACK_END: ' + rel + ' =====\n';
    count++;
  } catch (e) {
    console.error('  SKIP: ' + rel + ' (' + (e.message || 'unreadable') + ')');
  }
}

if (count === 0) {
  console.error('pack_text: no files found in ' + srcDir);
  process.exit(1);
}

/** META_DATA banner — single line at the very top of the pack stream. unpack_text
 *  strips it as noise (extended STATUS_LINE filter); view_pack_text preserves it
 *  inline so the provenance stays visible in human-readable view output. UTC
 *  timestamp keeps backups directly comparable across machines/timezones. */
const metaUtc = new Date().toISOString().replace(/\.\d+Z$/, 'Z');  // strip ms for readability
const metaLine = '===== META_DATA: host=' + metaHost
  + ' packed_utc=' + metaUtc
  + ' source=' + srcDir
  + ' file_count=' + count
  + ' encoding=' + encoding
  + ' =====\n';

fs.writeFileSync(outputFile, metaLine + output);
console.error('pack_text: packed ' + count + ' files from ' + srcDir);
PACK_TEXT_NODE
  } | PACK_SRC="$abs_src" PACK_LIST="$file_list" PACK_OUTPUT="$tmp_packed" PACK_META_HOST="$pack_host_raw" PACK_ENCODING="$pack_encoding" PACK_ENCODE_LEVEL="$pack_encode_level" node
  rm -f "$file_list"

  if [ ! -f "$tmp_packed" ]; then
    echo "pack_text: failed to generate packed content"
    return 1
  fi

  case "$mode" in
  tar)
    tar -czf "$output" -C /tmp "$content_name"
    rm -f "$tmp_packed"
    echo "pack_text: $output"
    ;;
  zip)
    command zip -qj "$output" "$tmp_packed"
    rm -f "$tmp_packed"
    echo "pack_text: $output"
    ;;
  raw)
    if [ -n "$output" ]; then
      mv "$tmp_packed" "$output"
      echo "pack_text: $output"
      # Always stream the saved file's contents to stdout at the end of raw
      # mode so `pack_text | unpack_text /tmp/copy` works without --raw.
      # The "pack_text: <path>" status line above is harmless on the receiving
      # end because unpack_text's noise filter strips status-line patterns
      # outside any pack block.
      command cat "$output"
    else
      command cat "$tmp_packed"
      rm -f "$tmp_packed"
    fi
    ;;
  esac
}

# unpack_text: parse a bulletproof pack and either extract files to disk
# (default) or re-emit it with text blocks decoded inline (--view mode).
# Input may be a file path, an explicit '-' stdin marker, or piped stdin.
# .tar.gz/.tgz/.tar/.zip archives are auto-extracted to a temp dir first.
function unpack_text() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "unpack_text: parse a bulletproof pack and extract files (or re-emit as text view)
  Usage: unpack_text [input_file|-] [dest_dir=.]
         unpack_text --view [input_file|-]               # re-emit, no disk writes
         <some command> | unpack_text [dest_dir=.]
  Modes:
    extract [default] — write each block's bytes to <dest_dir>/<path>, restore chmod
    --view            — re-emit the pack with text blocks decoded inline (no disk writes).
                        Output is itself a valid pack (text blocks have no encoding token,
                        binary blocks keep [gzip+base64,mode=0NNN]).
                        view_pack_text is just an alias for 'unpack_text --view'.
  Input sources (first match wins):
    1. explicit file path (\$1 is an existing file)     — archives auto-detected
    2. explicit stdin marker (\$1 == '-')                — reads pack text from stdin
    3. piped stdin (\$1 missing AND stdin is not a tty) — reads pack text from stdin
  Pack format:
    Each block is delimited by ===== PACK_BEGIN: <path> [<encoding>,mode=0NNN] =====
    and ===== PACK_END: <path> =====. unpack_text dispatches on the encoding token:
      gzip+base64 → base64-decode + gunzip → write bytes (extract) or decode+inline (view).
      no encoding → write the body verbatim (extract) or pass through (view).
    The mode field is applied via fs.chmodSync (a noop on Windows).
  Archives:
    .tar.gz, .tgz, .tar, .zip via the file-path form are extracted to a temp dir
    first; the inner pack file is located by searching for PACK_BEGIN. Stdin is
    always treated as plain pack text (no archive sniffing).
  Status noise filter:
    Lines outside any pack block matching /^(?:pack_text|unpack_text|view_pack_text):/
    are stripped before parsing, so 'pack_text 2>&1 | unpack_text' works even
    when stderr was merged into the stream. Lines INSIDE pack blocks are
    preserved verbatim — file content is never corrupted.
  Examples:
    unpack_text packed.txt ./output             # file -> extract
    unpack_text packed.tar.gz                   # archive -> extract to current dir
    cat packed.txt | unpack_text                # stdin -> extract to current dir
    pack_text ~/project | unpack_text /tmp/copy # round-trip via pipe
    unpack_text --view packed.txt               # human-readable view to stdout
    pack_text ~/project | unpack_text --view    # build + view in one go
    unpack_text - ./output                      # explicit stdin marker"
    return
  fi

  # Detect --view (or --to-text) flag and strip from positional args.
  local view_mode=0
  local positional=()
  for arg in "$@"; do
    case "$arg" in
    --view | --to-text) view_mode=1 ;;
    *) positional+=("$arg") ;;
    esac
  done
  set -- "${positional[@]}"

  # Decide input source. Same precedence used by the legacy stdin-aware version:
  #   1. \$1 == '-'                                  -> stdin
  #   2. no args AND stdin is piped                  -> stdin
  #   3. empty \$1 AND stdin is piped                -> stdin, optional \$2 dest
  #   4. \$1 looks like a file but doesn't exist AND stdin is piped -> stdin, \$1 is dest
  #   5. otherwise                                   -> \$1 is file path, \$2 is dest
  local input="" dest="." stdin_tmp=""
  if [ "${1:-}" = "-" ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="${2:-.}"
  elif [ $# -eq 0 ] && [ ! -t 0 ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="."
  elif [ -z "${1:-}" ] && [ ! -t 0 ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="${2:-.}"
  elif [ $# -ge 1 ] && [ ! -t 0 ] && [ ! -f "$1" ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="${1:-.}"
  else
    if [ -z "${1:-}" ]; then
      echo "unpack_text: no input file and stdin is not piped" >&2
      return 1
    fi
    input="$1"
    dest="${2:-.}"
    if [ ! -f "$input" ]; then
      echo "unpack_text: file not found: $input" >&2
      return 1
    fi
  fi

  if [ -n "$stdin_tmp" ] && [ ! -s "$stdin_tmp" ]; then
    echo "unpack_text: no data on stdin" >&2
    rm -f "$stdin_tmp"
    return 1
  fi

  # Resolve to absolute path.
  input=$(cd "$(dirname "$input")" && echo "$(command pwd)/$(basename "$input")")

  # Auto-extract tar/zip archives (file-mode only — stdin is always plain text).
  local tmp_extract=""
  if [ -z "$stdin_tmp" ]; then
    case "$input" in
    *.tar.gz | *.tgz | *.tar | *.zip)
      tmp_extract="/tmp/_unpack_text_$(command date +%s)_$$"
      mkdir -p "$tmp_extract"
      case "$input" in
      *.tar.gz | *.tgz) tar -xzf "$input" -C "$tmp_extract" ;;
      *.tar) tar -xf "$input" -C "$tmp_extract" ;;
      *.zip) command unzip -qo "$input" -d "$tmp_extract" ;;
      esac
      local inner
      inner=$(command grep -rl "===== PACK_BEGIN:" "$tmp_extract" 2> /dev/null | head -1)
      if [ -z "$inner" ]; then
        echo "unpack_text: no pack file found inside archive" >&2
        rm -rf "$tmp_extract"
        [ -n "$stdin_tmp" ] && rm -f "$stdin_tmp"
        return 1
      fi
      input="$inner"
      ;;
    esac
  fi

  # Resolve dest (only meaningful in extract mode, but harmless in --view).
  mkdir -p "$dest" 2> /dev/null
  local abs_dest
  abs_dest=$(cd "$dest" 2> /dev/null && command pwd)

  # Single node script handles BOTH extract and view modes — dispatched by
  # UNPACK_MODE. Parser, status-noise filter, and per-block decoder are inlined
  # here so this is the only Node.js source for the unpack/view side.
  {
    command cat << 'UNPACK_TEXT_NODE'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const inputFile = process.env.UNPACK_INPUT;
const destDir = process.env.UNPACK_DEST;
const viewMode = process.env.UNPACK_MODE === 'view';

/** Pack marker grammar:
 *    ===== PACK_BEGIN: <relative/path> [<key=val>,...] =====
 *    ===== PACK_END:   <relative/path> =====
 * Bracket is optional; absent means raw text content. */
const BEGIN_PREFIX = '===== PACK_BEGIN: ';
const END_PREFIX = '===== PACK_END: ';
const SUFFIX = ' =====';

/** Lines outside a block matching this regex are status noise leaked into the
 *  stream (e.g. `pack_text 2>&1 | unpack_text`); filtered before parsing. */
const STATUS_LINE = /^(?:pack_text|unpack_text|view_pack_text):/;

/** META_DATA banner emitted by pack_text at the top of the stream. Extract mode
 *  treats it as noise (file selection happens entirely via PACK_BEGIN markers).
 *  View mode preserves it (see captureMetaLine) so provenance stays visible. */
const META_DATA_LINE = /^===== META_DATA: .* =====$/;

/** Parse the metadata bracket on a BEGIN line into { path, encoding, mode }.
 *  Encoding is the only "bare" token (no '='); everything else is key=val.
 *  mode is parsed as octal. */
function parseBeginMarker(line) {
  if (!line.startsWith(BEGIN_PREFIX) || !line.endsWith(SUFFIX)) return null;
  const inner = line.slice(BEGIN_PREFIX.length, line.length - SUFFIX.length);
  const m = inner.match(/^(.*?)(?:\s+\[([^\]]*)\])?$/);
  if (!m) return null;
  const meta = { path: m[1], encoding: null, mode: null };
  if (m[2]) {
    for (const part of m[2].split(',')) {
      const eq = part.indexOf('=');
      if (eq === -1) {
        if (part.trim()) meta.encoding = part.trim();
      } else {
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k === 'mode') meta.mode = parseInt(v, 8);
      }
    }
  }
  return meta;
}

/** Drop pack_text:/unpack_text:/view_pack_text: lines outside pack blocks.
 *  Lines inside blocks are preserved verbatim — file content is never corrupted. */
function stripStatusNoise(raw) {
  const lines = raw.split('\n');
  const out = [];
  let inBlock = false;
  let currentEndMarker = '';
  for (const line of lines) {
    if (!inBlock && line.startsWith(BEGIN_PREFIX) && line.endsWith(SUFFIX)) {
      const meta = parseBeginMarker(line);
      if (meta) {
        currentEndMarker = END_PREFIX + meta.path + SUFFIX;
        inBlock = true;
      }
      out.push(line);
      continue;
    }
    if (inBlock && line === currentEndMarker) {
      inBlock = false;
      currentEndMarker = '';
      out.push(line);
      continue;
    }
    if (!inBlock && STATUS_LINE.test(line)) continue;
    if (!inBlock && META_DATA_LINE.test(line)) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** Scan the raw stream for the first META_DATA line and return it (or null).
 *  Used by view mode to re-emit the banner at the top of the view output so
 *  provenance stays visible AND view output is re-feedable into unpack_text. */
function captureMetaLine(raw) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith(BEGIN_PREFIX)) break;  // metadata only valid before any PACK_BEGIN
    if (META_DATA_LINE.test(line)) return line;
  }
  return null;
}

/** Generator yielding each block as { path, encoding, mode, body }. */
function* parseBlocks(packed) {
  let pos = 0;
  while (pos < packed.length) {
    const bIdx = packed.indexOf(BEGIN_PREFIX, pos);
    if (bIdx === -1) break;
    const bLineEnd = packed.indexOf('\n', bIdx);
    if (bLineEnd === -1) break;
    const meta = parseBeginMarker(packed.slice(bIdx, bLineEnd));
    if (!meta) { pos = bLineEnd + 1; continue; }
    const contentStart = bLineEnd + 1;
    const endMarker = END_PREFIX + meta.path + SUFFIX;
    const eIdx = packed.indexOf('\n' + endMarker, contentStart);
    if (eIdx === -1) {
      console.error('  WARN: no PACK_END for ' + meta.path + ', skipping');
      pos = contentStart;
      continue;
    }
    yield Object.assign({}, meta, { body: packed.slice(contentStart, eIdx + 1) });
    pos = eIdx + 1 + endMarker.length + 1;
  }
}

/** Decode a block's body to a Buffer based on its encoding token. Per-block
 *  dispatch means a single pack can legally mix encodings — e.g. an old gzip
 *  pack appended to a fresh brotli pack still extracts cleanly. */
function decodeBlock(block) {
  if (block.encoding === 'gzip+base64') {
    return zlib.gunzipSync(Buffer.from(block.body.replace(/\s/g, ''), 'base64'));
  }
  if (block.encoding === 'brotli+base64') {
    if (typeof zlib.brotliDecompressSync !== 'function') {
      throw new Error('brotli requires Node >= 11.7');
    }
    return zlib.brotliDecompressSync(Buffer.from(block.body.replace(/\s/g, ''), 'base64'));
  }
  // No encoding token → raw text. Strip the trailing newline emitted between
  // the body and the END marker so round-trip is byte-exact for raw blocks.
  const text = block.body.endsWith('\n') ? block.body.slice(0, -1) : block.body;
  return Buffer.from(text, 'utf8');
}

/** Heuristic: a buffer is "text" if no NUL byte in the first 8 KB. */
function looksLikeText(buf) {
  return !buf.subarray(0, 8000).includes(0x00);
}

/** Build the [<encoding>,mode=0NNN] bracket suffix for re-emitted blocks. */
function fmtMeta(meta) {
  const parts = [];
  if (meta.encoding) parts.push(meta.encoding);
  if (meta.mode != null) parts.push('mode=' + meta.mode.toString(8).padStart(4, '0'));
  return parts.length ? ' [' + parts.join(',') + ']' : '';
}

const rawInput = fs.readFileSync(inputFile, 'utf8');
const metaLine = captureMetaLine(rawInput);  // null if pack predates META_DATA support
const packed = stripStatusNoise(rawInput);

if (viewMode) {
  // VIEW mode — re-emit the pack with text blocks decoded inline. Binary blocks
  // (decoded buffer has a NUL byte in first 8 KB) pass through unchanged. The
  // META_DATA banner (if present) is re-emitted at the top so the view output
  // keeps its provenance AND remains a valid pack re-feedable into unpack_text.
  if (metaLine) process.stdout.write(metaLine + '\n');
  for (const block of parseBlocks(packed)) {
    let decoded;
    try { decoded = decodeBlock(block); }
    catch {
      // Could not decode (corrupt block) — pass through untouched.
      process.stdout.write(BEGIN_PREFIX + block.path + fmtMeta(block) + SUFFIX + '\n');
      process.stdout.write(block.body);
      process.stdout.write(END_PREFIX + block.path + SUFFIX + '\n');
      continue;
    }
    if (looksLikeText(decoded)) {
      // Always emit a separator newline between content and END marker. The
      // unpack-side decoder for raw blocks strips the trailing '\n' from the
      // body, so this guarantees byte-exact round-trip whether or not the
      // original file ended with a newline.
      process.stdout.write(BEGIN_PREFIX + block.path + fmtMeta({ encoding: null, mode: block.mode }) + SUFFIX + '\n');
      process.stdout.write(decoded.toString('utf8'));
      process.stdout.write('\n');
      process.stdout.write(END_PREFIX + block.path + SUFFIX + '\n');
    } else {
      process.stdout.write(BEGIN_PREFIX + block.path + fmtMeta(block) + SUFFIX + '\n');
      process.stdout.write(block.body);
      process.stdout.write(END_PREFIX + block.path + SUFFIX + '\n');
    }
  }
} else {
  // EXTRACT mode — write each block's bytes to disk and restore mode.
  let count = 0;
  for (const block of parseBlocks(packed)) {
    const destPath = path.join(destDir, block.path);
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, decodeBlock(block));
      if (block.mode != null) {
        try { fs.chmodSync(destPath, block.mode); } catch {}
      }
      console.log('  EXTRACT: ' + block.path);
      count++;
    } catch (e) {
      console.error('  FAIL: ' + block.path + ': ' + e.message);
    }
  }
  console.log('unpack_text: extracted ' + count + ' files to ' + destDir);
}
UNPACK_TEXT_NODE
  } | UNPACK_INPUT="$input" UNPACK_DEST="$abs_dest" UNPACK_MODE="$( ((view_mode)) && echo view || echo extract)" node

  # Cleanup tmp files.
  if [ -n "$tmp_extract" ]; then
    rm -rf "$tmp_extract"
  fi
  if [ -n "$stdin_tmp" ]; then
    rm -f "$stdin_tmp"
  fi
}

# view_pack_text: thin alias for `unpack_text --view`. Re-emits a pack with text
# blocks decoded inline; binary blocks stay [gzip+base64,mode=0NNN]. Output is a
# valid pack — re-feedable into unpack_text. Useful for grep/diff/edit on a
# bundle without unpacking files to disk.
function view_pack_text() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "view_pack_text: alias for 'unpack_text --view' — re-emit a pack with text decoded inline
  Usage: view_pack_text [input_file|-]
         <some command> | view_pack_text
  Examples:
    view_pack_text packed.txt | grep 'function foo'
    view_pack_text packed.txt > readable.pack.txt
    pack_text ~/project | view_pack_text
    pack_text ~/project | view_pack_text | unpack_text /tmp/copy"
    return
  fi
  unpack_text --view "$@"
}
