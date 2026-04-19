#!/usr/bin/env bash
# Profile partial — inlined into ~/.bash_syle via SOURCE marker, not run standalone.

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
  cat << '_HELPERS_EOF'
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
    cat << 'CPSYNC_NODE'
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
    cat << 'CPFILES_NODE'
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
    cat << 'DEDUP_NODE'
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
