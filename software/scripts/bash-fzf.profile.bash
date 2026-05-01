#!/usr/bin/env bash

# run: bash run.sh --files="fzf.js"
################################################################################
# ---- FZF Fuzzy Finder Integration ----
#
# --- Filter ---
# filter_unwanted        — Pipe filter: removes ignored folders/binary paths
#
# --- Pickers ---
# fuzzy_recent_files     — FZF picker for recently opened files
# view_file              — Open a file with the default editor (subl)
# fuzzy_favorite_command — FZF picker for bookmarked commands (Ctrl+B)
# fuzzy_cd               — FZF cd picker: recent paths + folders (Ctrl+P)
# fuzzy_edit             — FZF file/dir picker, open with editor (Ctrl+T/Y)
# fuzzy_git_show         — Interactive git log browser with preview (Ctrl+G)
#
# --- Bookmarks ---
# add_bookmark           — Add a command to the bookmark file
# add_bookmark_dir       — Bookmark a directory (as "cd <dir>")
#
# Configures FZF defaults, aliases (glog, fvim), and provides the
# _fuzzy_list_all directory crawler (Node.js BFS with git fast path).
################################################################################
export FZF_COMPLETION_TRIGGER='*'
export FZF_DEFAULT_OPTS="
  --info-command='_fzf_info_line'
  --bind 'shift-left:preview-page-up'
  --bind 'shift-right:preview-page-down'
  --bind 'ctrl-left:preview-page-up'
  --bind 'ctrl-right:preview-page-down'
  --bind 'ctrl-up:preview-up'
  --bind 'ctrl-down:preview-down'
  --bind 'ctrl-f:page-down'
  --bind 'ctrl-b:page-up'
  --bind 'ctrl-\\:toggle-preview'
"

# ---- Aliases: Git (fzf) ----
alias glog='fuzzy_git_show'
alias fzf='fzf --ansi --no-sort --cycle --layout=reverse --tiebreak=index'
alias fvim='fuzzy_edit vim'

################################################################################
# ---- Filter Functions ----
# Shared by fuzzy_edit, autocomplete nested tokens, and fzf-tab-completion.
# Single source of truth — sourced into profile-advanced.sh and autocomplete tests.
################################################################################
function filter_unwanted() {
  # _IGNORED_FOLDER_PATTERNS / _IGNORED_FILE_PATTERNS are bootstrapped from
  # EDITOR_CONFIGS.{ignoredFoldersRegex,ignoredFilesRegex} by
  # software/scripts/advanced/fuzzy-patterns.js. Both arrays feed into a
  # single grep -v -E so callers (pack_text, cprepo, fuzzy_edit, autocomplete)
  # share a single source of truth for both folder excludes
  # (node_modules, .venv, .git/, etc.) and file-extension excludes
  # (.swp, .exe, .pyc, etc.). Fallback list below covers minimal shell
  # environments (e.g. tests sourcing this file standalone) where the
  # bootstrap hasn't run yet.
  local patterns=()
  if declare -p _IGNORED_FOLDER_PATTERNS &> /dev/null; then
    patterns+=("${_IGNORED_FOLDER_PATTERNS[@]}")
  fi
  if declare -p _IGNORED_FILE_PATTERNS &> /dev/null; then
    patterns+=("${_IGNORED_FILE_PATTERNS[@]}")
  fi
  if [ ${#patterns[@]} -eq 0 ]; then
    patterns=(
      # folder regex
      '\.DS_Store'
      '\.angular/'
      '\.cache/'
      '\.git/'
      '\.gradle/'
      '\.hg/'
      '\.idea/'
      '\.ipynb_checkpoints/'
      '\.mypy_cache/'
      '\.next/'
      '\.nuxt/'
      '\.parcel-cache/'
      '\.pyc'
      '\.pytest_cache/'
      '\.ruff_'
      '\.sass-cache/'
      '\.svelte-kit/'
      '\.svn/'
      '\.terraform/'
      '\.tox/'
      '\.turbo/'
      '\.uv/'
      '\.venv/'
      '\.yarn/'
      '__pycache'
      'bower_components'
      'node_modules'
      '/build/'
      '/coverage/'
      '/cov/'
      '/DerivedData/'
      '/dist/'
      '/htmlcov/'
      '/out/'
      '/Pods/'
      '/target/'
      '/vendor/'
      # file regex (anchored to end of basename / line)
      '\.DS_Store$'
      'Thumbs\.db$'
      'desktop\.ini$'
      '\.Spotlight-'
      '\.Trashes$'
      '\.fseventsd$'
      '\.com\.apple\.'
      '\.localized$'
      '\.a$'
      '\.class$'
      '\.dll$'
      '\.dylib$'
      '\.exe$'
      '\.lib$'
      '\.o$'
      '\.obj$'
      '\.pyc$'
      '\.pyo$'
      '\.so$'
      '\.swo$'
      '\.swp$'
      '\.wasm$'
    )
  fi
  local joined
  joined=$(
    IFS='|'
    echo "${patterns[*]}"
  )
  command grep -v -E "$joined"
}

################################################################################
# ---- Fuzzy List All ----
# Lists all paths: dirs with trailing /, files without.
# Used by fuzzy_edit and autocomplete nested tokens.
################################################################################
# _IGNORED_*_JSON / _FUZZY_TEXT_FILES_JSON variables are bootstrapped from
# EDITOR_CONFIGS by software/scripts/advanced/fuzzy-patterns.js (registered as
# the "Fuzzy Filter Patterns" profile block sourced before this file). The
# hardcoded fallbacks below cover minimal shell environments (e.g. tests
# sourcing this file standalone) where the bootstrap hasn't run yet — they
# intentionally mirror EDITOR_CONFIGS.{ignoredFoldersRegex,ignoredFilesRegex,
# textFilesRegex}. The _IGNORED_*_JSON pair is general-purpose (consumed by
# pack_text and other pipelines too); _FUZZY_TEXT_FILES_JSON is fuzzy-picker
# specific.
# JSON pattern arrays — passed directly to node as process.argv (proper JS regex strings)
# folder patterns — skip ignored dirs during traversal
[ -z "${_IGNORED_FOLDERS_JSON+x}" ] && _IGNORED_FOLDERS_JSON='["\\.DS_Store","\\.angular/","\\.cache/","\\.git/","\\.gradle/","\\.hg/","\\.idea/","\\.ipynb_checkpoints/","\\.mypy_cache/","\\.next/","\\.nuxt/","\\.parcel-cache/","\\.pyc","\\.pytest_cache/","\\.ruff_","\\.sass-cache/","\\.svelte-kit/","\\.svn/","\\.terraform/","\\.tox/","\\.turbo/","\\.uv/","\\.venv/","\\.yarn/","__pycache","bower_components","node_modules","/build/","/coverage/","/cov/","/DerivedData/","/dist/","/htmlcov/","/out/","/Pods/","/target/","/vendor/"]'
# ignored file patterns — exclude binary files, system junk, and non-text files
[ -z "${_IGNORED_FILES_JSON+x}" ] && _IGNORED_FILES_JSON='["\\.DS_Store$","Thumbs\\.db$","desktop\\.ini$","\\.Spotlight-","\\.Trashes$","\\.fseventsd$","\\.com\\.apple\\.","\\.localized$","\\.a$","\\.class$","\\.dll$","\\.dylib$","\\.exe$","\\.lib$","\\.o$","\\.obj$","\\.pyc$","\\.pyo$","\\.so$","\\.swo$","\\.swp$","\\.wasm$"]'
# text file extension allowlist — used by text_files mode
[ -z "${_FUZZY_TEXT_FILES_JSON+x}" ] && _FUZZY_TEXT_FILES_JSON='["\\.bash$","\\.c$","\\.cfg$","\\.clj$","\\.cmake$","\\.coffee$","\\.conf$","\\.cpp$","\\.cs$","\\.css$","\\.csv$","\\.dart$","\\.diff$","\\.dockerfile$","\\.el$","\\.elm$","\\.env$","\\.erl$","\\.ex$","\\.fish$","\\.go$","\\.graphql$","\\.groovy$","\\.h$","\\.hpp$","\\.hs$","\\.html$","\\.ini$","\\.java$","\\.js$","\\.json$","\\.jsonc$","\\.jsx$","\\.kt$","\\.less$","\\.lisp$","\\.log$","\\.lua$","\\.m$","\\.md$","\\.mk$","\\.ml$","\\.nim$","\\.nix$","\\.php$","\\.pl$","\\.proto$","\\.ps1$","\\.py$","\\.r$","\\.rb$","\\.rs$","\\.rst$","\\.sass$","\\.scala$","\\.scss$","\\.sh$","\\.sql$","\\.svelte$","\\.swift$","\\.tcl$","\\.tex$","\\.tf$","\\.toml$","\\.ts$","\\.tsx$","\\.txt$","\\.v$","\\.vim$","\\.vue$","\\.xml$","\\.yaml$","\\.yml$","\\.zig$","\\.zsh$","Dockerfile$","Makefile$","Rakefile$","Gemfile$","Vagrantfile$","\\.gitignore$","\\.gitattributes$","\\.editorconfig$","\\.eslintrc$","\\.prettierrc$","\\.babelrc$"]'

# usage: _fuzzy_list_all [dir] [mode] [max_depth] [timeout] [filter]
#   dir       — directory to list (default: .)
#   mode      — 'folders', 'files', 'text_files', 'paths' or '' (default: paths)
#   max_depth — optional depth limit (default: unlimited)
#   timeout   — max seconds before self-terminating (default: 3)
#   filter    — prefix filter for top-level entries (default: '' = no filter)
function _fuzzy_list_all() {
  local dir="${1:-.}" mode="${2:-paths}" max_depth="${3:-}" max_timeout="${4:-3}" filter="${5:-}"
  # resolve tilde, relative paths, and trailing slashes so "." check and node both work
  [[ "$dir" == \~* ]] && eval dir="$dir" 2> /dev/null
  dir="${dir%/}"
  # edge case: dir="/" becomes "" after stripping trailing slash — restore to "/" (root), not "."
  [ -z "$dir" ] && dir="/"
  # BFS directory crawler in node.
  #
  # Walks `dir` and emits relative paths to stdout, filtered by `mode`:
  #   paths      — files + folders (single git ls-files call, dirs derived from paths)
  #   files      — files only
  #   text_files — files matching text-file extensions only
  #   folders    — folders only
  #
  # Git fast path: when a directory is a git repo (has .git/), uses async
  # `git ls-files` / `git ls-tree` instead of readdirSync. For `paths` mode
  # only one git command runs (ls-files) and directories are derived from
  # file paths to avoid a second call. Nested git repos discovered during
  # BFS are processed in parallel via Promise.all.
  #
  # Prefix filter (optional `filter` arg): when set, only top-level entries
  # whose name starts with `filter` are processed. This is the key perf
  # optimisation for tab-completion — e.g. `vim ~/.gi<tab>` passes dir="~/"
  # and filter=".gi", so only .git/, .github/, .gitconfig etc. are crawled
  # instead of the entire home directory. The filter is case-insensitive.
  # When filter is empty (fzf pickers like fvim), everything is listed.
  #
  # Self-terminates after max_timeout seconds (deadline-based).
  node -e "
    const fs = require('fs');
    const path = require('path');
    const {exec} = require('child_process');
    const dir = process.argv[1];
    const mode = process.argv[2];
    const maxDepth = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity;
    const folderPats = JSON.parse(process.argv[4]).map(p => new RegExp(p));
    const filePats = JSON.parse(process.argv[5]).map(p => new RegExp(p));
    const textPats = JSON.parse(process.argv[6]).map(p => new RegExp(p));
    const filter = (process.argv[8] || '').toLowerCase();
    const envTimeoutSec = parseInt(process.env.BASHRC_FUZZY_TIMEOUT || '0', 10);
    const argTimeoutSec = parseInt(process.argv[7], 10);
    const timeoutMs = Math.max(envTimeoutSec, argTimeoutSec) * 1000;
    const deadline = Date.now() + timeoutMs;
    const isTextFiles = mode === 'text_files';
    function matchesFilter(name) { return !filter || name.toLowerCase().startsWith(filter); }
    function isGitRepo(abs) { try { return fs.statSync(path.join(abs, '.git')).isDirectory(); } catch { return false; } }
    function emit(rp) {
      const isDir = rp.endsWith('/');
      if (folderPats.some(r => r.test(rp))) return;
      if (isDir) {
        if (mode !== 'files' && mode !== 'text_files') process.stdout.write(rp + '\n');
      } else if (mode !== 'folders') {
        if (isTextFiles && !textPats.some(r => r.test(rp))) return;
        if (!isTextFiles && filePats.some(r => r.test(rp))) return;
        process.stdout.write(rp + '\n');
      }
    }
    function remainingMs() { return Math.max(1, deadline - Date.now()); }
    function execAsync(cmd, opts) {
      return new Promise((resolve) => {
        exec(cmd, opts, (err, stdout) => resolve(err ? '' : stdout));
      });
    }
    function topName(p) { const i = p.indexOf('/'); return i === -1 ? p : p.slice(0, i); }
    async function emitGitRepo(abs, rel) {
      const useFilter = filter && !rel;
      if (mode === 'paths') {
        const out = await execAsync('git ls-files --full-name 2>/dev/null', {cwd: abs, encoding: 'utf-8', timeout: remainingMs()});
        const files = out.trim();
        if (!files) return;
        const dirs = new Set();
        for (const f of files.split('\n')) {
          if (useFilter && !matchesFilter(topName(f))) continue;
          let i = f.indexOf('/');
          while (i !== -1) { dirs.add(f.slice(0, i + 1)); i = f.indexOf('/', i + 1); }
          emit(rel ? rel + '/' + f : f);
        }
        for (const d of dirs) emit(rel ? rel + '/' + d : d);
      } else if (mode === 'folders') {
        const out = await execAsync('git ls-tree -r -d --name-only HEAD 2>/dev/null', {cwd: abs, encoding: 'utf-8', timeout: remainingMs()});
        const dirs = out.trim();
        if (dirs) for (const d of dirs.split('\n')) {
          if (useFilter && !matchesFilter(topName(d))) continue;
          emit(rel ? rel + '/' + d + '/' : d + '/');
        }
      } else {
        const out = await execAsync('git ls-files --full-name 2>/dev/null', {cwd: abs, encoding: 'utf-8', timeout: remainingMs()});
        const files = out.trim();
        if (files) for (const f of files.split('\n')) {
          if (useFilter && !matchesFilter(topName(f))) continue;
          emit(rel ? rel + '/' + f : f);
        }
      }
    }
    (async () => {
    if (isGitRepo(dir)) { await emitGitRepo(dir, ''); process.exit(0); }
    const queue = [{abs: dir, rel: '', depth: 0}];
    const gitPromises = [];
    while (queue.length) {
      if (Date.now() > deadline) break;
      const {abs, rel, depth} = queue.shift();
      let entries;
      try { entries = fs.readdirSync(abs, {withFileTypes: true}); } catch { continue; }
      for (const e of entries) {
        const name = e.name;
        if (filter && depth === 0 && !matchesFilter(name)) continue;
        const rp = rel ? rel + '/' + name : name;
        const isDir = e.isDirectory();
        const label = isDir ? rp + '/' : rp;
        if (folderPats.some(r => r.test(label))) continue;
        if (isDir) {
          if (isGitRepo(path.join(abs, name))) {
            if (mode !== 'files' && mode !== 'text_files') process.stdout.write(label + '\n');
            gitPromises.push(emitGitRepo(path.join(abs, name), rp));
            continue;
          }
          if (mode !== 'files' && mode !== 'text_files') process.stdout.write(label + '\n');
          if (depth + 1 < maxDepth) queue.push({abs: path.join(abs, name), rel: rp, depth: depth + 1});
        } else {
          emit(label);
        }
      }
    }
    await Promise.all(gitPromises);
    })();
  " "$dir" "$mode" "$max_depth" "$_IGNORED_FOLDERS_JSON" "$_IGNORED_FILES_JSON" "$_FUZZY_TEXT_FILES_JSON" "$max_timeout" "$filter"
}

################################################################################
# ---- FZF Functions ----
################################################################################
# dynamic info line for fzf - shows context-aware label based on prompt
function _fzf_info_line() {
  local label="results"
  case "$FZF_PROMPT" in
  *"Paths>"*) label="paths" ;;
  *"Files>"*) label="files" ;;
  *"Commits>"*) label="commits" ;;
  *"Bookmarks>"*) label="bookmarks" ;;
  *"Recent Files>"*) label="recent files" ;;
  "> "*) label="completions" ;;
  esac
  echo "$FZF_MATCH_COUNT of $FZF_TOTAL_COUNT $label"
}

# fzf picker for recently opened files — opens selected file with view_file or optional editor arg
function fuzzy_recent_files() {
  local VIEW_COMMAND="${1:-}"
  local OUT=$(echo "$(_recent_files)" | fzf +m --prompt="recent files> " \
    --header="fuzzy_recent_files (Ctrl+Y) — recently opened files" \
    --preview='batcat --paging=never --style=plain --color=always {} 2>/dev/null || command cat {} 2>/dev/null' --preview-window=right:60%)
  if [ -n "$OUT" ] && [ -f "$OUT" ]; then
    if [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
      echo "$VIEW_COMMAND \"$OUT\""
      "$VIEW_COMMAND" "$OUT"
    else
      echo "view_file \"$OUT\""
      view_file "$OUT"
    fi
  fi
}

################################################################################
# ---- FZF Advanced Helper Functions ----
################################################################################
# override view_file with editor
function view_file() {
  if [[ $# -eq 0 ]]; then
    return 1 # silent exit
  fi
  local editorCmd=subl
  print_action_summary "$1" "$editorCmd"
  $editorCmd "$1"
}

################################################################################
# ---- FZF Advanced Helper Functions ----
################################################################################
# ---- Bookmark Fzf Helper Functions ----
BOOKMARK_PATH="$HOME/.${USER}_bookmark"

function add_bookmark() {
  local content
  content=$({
    echo "$1"
    command cat "$BOOKMARK_PATH" 2> /dev/null
  } | sort -u)
  echo "$content" > "$BOOKMARK_PATH"
}

function add_bookmark_dir() {
  dir="${1:-$(pwd)}"
  add_bookmark "cd $dir"
}

# Ctrl+B — fuzzy favorite command picker
function fuzzy_favorite_command() {
  local cmd
  cmd=$(command cat "$BOOKMARK_PATH" 2> /dev/null | sort -u | fzf --prompt="bookmark> " \
    --header="fuzzy_favorite_command (Ctrl+B) — bookmarked commands" \
    --preview='cmd={};word=$(echo "$cmd" | awk "{print \$1}"); type "$word" 2>&1; echo ""; echo "---"; echo "$cmd"' \
    --preview-window=right:40% \
    --bind 'f5:reload(command cat "$BOOKMARK_PATH" 2>/dev/null | sort -u)')

  if [ -n "$cmd" ]; then
    echo "### Command Selected from Bookmarks ###"
    echo "$cmd"
    eval "$cmd"
    history -s "$cmd"
  fi
}

# ---- File related Fzf Helper Functions ----
# Ctrl+P — fzf cd picker (PWD subfolders first, then recent folders marked with ★)
# Each line is "<marker>\t<path>"; fzf shows both columns but searches only the path
# (--nth=2). Selection extracts the path via "${OUT##*$'\t'}".
function _fuzzy_cd_list() {
  local dir="${1:-.}"
  _fuzzy_list_all "$dir" "folders" "" 10 | awk '{print "  \t" $0}'
  _recent_folders 2> /dev/null | awk '{print "★ \t" $0}'
}
function fuzzy_cd() {
  local dir="${1:-.}"
  local abs_dir
  abs_dir=$(cd "$dir" 2> /dev/null && command pwd || echo "$dir")
  local OUT=$(_fuzzy_cd_list "$dir" | awk -F'\t' '!seen[$2]++' | fzf +m \
    --delimiter=$'\t' --with-nth=1,2 --nth=2 \
    --prompt="cd> " \
    --header="fuzzy_cd (Ctrl+P) — ★ recent folders, plain = under ${abs_dir}" \
    --preview='ls -Cp --color=always {2} 2>/dev/null' --preview-window=right:40% \
    --bind "f5:reload(_fuzzy_cd_list '$dir' | awk -F'\t' '!seen[\$2]++')")
  if [ -n "$OUT" ]; then
    OUT="${OUT##*$'\t'}"
    if [ -d "$OUT" ]; then
      print_action_summary "$OUT"
      cd "$OUT"
    else
      echo "Path no longer exists: $OUT"
    fi
  fi
}

# Ctrl+T (vim) / Ctrl+Y (default editor) — fzf editor picker for files and directories
function fuzzy_edit() {
  local VIEW_COMMAND="$1"
  local dir="${2:-.}"
  local abs_dir
  abs_dir=$(cd "$dir" 2> /dev/null && command pwd || echo "$dir")
  local OUT=$(_fuzzy_list_all "$dir" "paths" "" 10 | fzf --prompt="edit> " \
    --header="fuzzy_edit (Ctrl+T) — files under ${abs_dir}" \
    --bind "f5:reload(_fuzzy_list_all '$dir' 'paths' '' 10)")

  if [ -z "$OUT" ]; then
    return
  fi

  # check if selection is a directory (trailing /)
  local IS_DIR=false
  if [[ "$OUT" == */ ]]; then
    IS_DIR=true
    OUT="${OUT%/}"
  fi

  local FULL_PATH
  FULL_PATH=$(cd "$(git rev-parse --show-toplevel 2> /dev/null || echo ".")" && realpath "$OUT")

  # Folder selections: just print PWD + cd. File selections: also print the editor line
  # (mirrors what we're about to invoke). print_action_summary handles the format.
  if [ "$IS_DIR" = true ]; then
    print_action_summary "$FULL_PATH"
    cd "$FULL_PATH"
  else
    local EDIT_CMD
    if [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
      EDIT_CMD="$VIEW_COMMAND"
    else
      EDIT_CMD="view_file"
    fi
    print_action_summary "$FULL_PATH" "$EDIT_CMD"
    if [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
      "$VIEW_COMMAND" "$OUT"
    else
      view_file "$OUT"
    fi
  fi
}

# Ctrl+G — interactive git log browser with commit preview
function fuzzy_git_show() {
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always \
    | fzf --prompt="Commits> " \
      --preview-window=right:60% \
      --preview='hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | head -1);
      git log --color=always --format="%C(yellow)%H%n%C(cyan)Author: %an <%ae>%n%C(green)Date:   %ad%n%n%C(bold white)%s%C(reset)%n%n%b" -1 $hash;
      echo "$LINE_BREAK_HASH";
      git diff-tree --no-commit-id --stat --color=always $hash;
      echo "";
      git diff-tree --no-commit-id -p --color=always $hash' \
      --bind "ctrl-m:execute:(echo {} | grep -o '[a-f0-9]\{7\}' | head -1 | xargs -I % sh -c 'git show --color=always % | (bat --paging=always --style=plain 2>/dev/null || batcat --paging=always --style=plain 2>/dev/null || less -R)')" \
      --bind "f5:reload(git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always)"
}
