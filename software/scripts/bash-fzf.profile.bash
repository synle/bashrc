#!/usr/bin/env bash

# run: bash run.sh --files="fzf.js"
################################################################################
# --- FZF Fuzzy Finder Integration ---
#
# --- Filter ---
# filter_unwanted        — Pipe filter: removes ignored folders/binary paths
#
# --- Pickers ---
# fuzzy_recent_files     — FZF picker for recently opened files
# view_file              — Open a file with the default editor (zed)
# fuzzy_favorite_command — FZF picker for bookmarked commands (Ctrl+B)
# fuzzy_cd               — FZF cd picker: recent paths + folders (Ctrl+P, fcd)
# fuzzy_edit             — FZF file/dir picker, open with editor (Ctrl+T/Y)
#                          aliases: fvim / fzed / fsubl / fcode / fcat / fcopy
# fuzzy_git_show         — Interactive git log browser with preview (Ctrl+N)
#
# --- Bookmarks ---
# add_bookmark           — Add a command to the bookmark file
# add_bookmark_dir       — Bookmark a directory (as "cd <dir>")
#
# Configures FZF defaults, aliases (glog, fvim, fzed, fsubl), and provides the
# _fuzzy_list_all directory crawler (Node.js BFS combined with git fast path).
################################################################################
export FZF_COMPLETION_TRIGGER='*'
# Single source of truth for fzf defaults. All flags here apply to every fzf
# invocation (functions, command-line, completion) without relying on alias
# expansion — which is fragile inside function bodies sourced from a profile.
# --ansi is required for colored input (e.g. git log --color=always); harmless
# on plain text. --no-sort + --tiebreak=index preserve input order so picker
# functions can rely on the order they emit. --layout=reverse puts input at
# top. --cycle wraps list navigation.
export FZF_DEFAULT_OPTS="
  --ansi
  --no-sort
  --cycle
  --layout=reverse
  --tiebreak=index
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

################################################################################
# --- Case-sensitivity override (fzf_run + generated doubled-prefix variants) ---
#
# fzf fixes its match-case mode at startup — there is NO runtime action for it
# (`--bind alt-c:toggle-case` is rejected: "unknown action", fzf 0.74.2), and
# an unknown action in FZF_DEFAULT_OPTS would make EVERY picker exit with an
# error. So the override happens at launch instead, through one wrapper.
#
# FZF_DEFAULT_OPTS is deliberately left alone. fzf parses it first and argv
# second, and argv wins:
#   FZF_DEFAULT_OPTS="-i" fzf +i --filter=ABC   # matches ABC only
# so `fzf_run` appending a flag is enough to override the default for one call.
#
# Flag meanings (they are the reverse of what they look like):
#   -i  case-INsensitive     +i  case-SENSITIVE     neither  smart-case
# Smart-case (the default here) is already case-insensitive until the query
# contains an uppercase char, so the override that earns its keep is `-i`.
################################################################################

# fzf_run: run fzf with the case mode requested by $FZF_CASE_MODE
#
# Every picker in this repo calls `fzf_run` rather than `fzf`, so a caller can
# force a case mode for one invocation without touching FZF_DEFAULT_OPTS:
#   FZF_CASE_MODE=insensitive fuzzy_cd
# A leading `VAR=x` on a shell-function call is temporary in bash (verified:
# the variable is restored afterwards), so nothing leaks into the session.
#
# The flag is appended AFTER "$@" because argv is last-wins — that makes the
# env override beat any case flag a picker hardcodes.
function fzf_run() {
  if is_help_arg "${1:-}"; then
    echo "fzf_run: run fzf with the case mode from \$FZF_CASE_MODE
  Usage: fzf_run [<fzf args>...]                 # smart-case (default)
         FZF_CASE_MODE=insensitive fzf_run ...   # force -i
         FZF_CASE_MODE=sensitive   fzf_run ...   # force +i

Every picker here routes through this, so the doubled-prefix variants
(ifcd, ifuzzy_cd, ...) work without any picker knowing about case modes."
    return 0
  fi

  local case_opt=""
  case "${FZF_CASE_MODE:-}" in
  insensitive) case_opt="-i" ;;
  sensitive) case_opt="+i" ;;
  esac

  # Unquoted on purpose: case_opt is one bare token or empty, and an empty
  # quoted "$case_opt" would hand fzf an empty argument it rejects.
  command fzf "$@" $case_opt
}

# fzf_register_case_variants: define the case-insensitive twin of every picker
#
# Naming is an `i` PREFIX on the existing name — the same `i` as fzf's own
# case-insensitive flag, so the mnemonic is the flag itself:
#   fuzzy_cd -> ifuzzy_cd    fcd -> ifcd    fcat -> ifcat    glog -> iglog
#
# The generation itself is generic and lives in profile-core.sh
# (`register_command_variants`); this function is the fzf-specific CALL, kept
# as a named entry point so a partial sourced later can re-run it after adding
# a picker. Both variant sources are covered: `fuzzy_*` shell functions, and
# aliases whose target is a `fuzzy_*` call — aliases cannot be invoked from a
# function body, so the alias TARGET is what the twin embeds.
#
# `command_variants` lists what came out. Existing names are never clobbered.
function fzf_register_case_variants() {
  if is_help_arg "${1:-}"; then
    echo "fzf_register_case_variants: (re)generate the i-prefixed case-insensitive pickers
  Usage: fzf_register_case_variants
  Covers fuzzy_* functions and aliases expanding to them. Idempotent.
  Run \`command_variants i\` to see what exists."
    return 0
  fi

  register_command_variants \
    --prefix=i \
    --select-fn='^fuzzy_' \
    --select-alias='^fuzzy_' \
    --env='FZF_CASE_MODE=insensitive'
}

# --- Aliases: Git (fzf) ---
alias glog='fuzzy_git_show'
alias fvim='fuzzy_edit vim'
alias fcat='fuzzy_edit cat'
# Short form of the Ctrl+P picker, so it is reachable without the chord.
alias fcd='fuzzy_cd'
# Pick a file, then push its CONTENTS onto the clipboard + clipboard history.
# `copy` is a shell function (bash-clipboard.profile.bash), not a PATH binary —
# fuzzy_edit resolves it because is_runnable_command accepts functions.
alias fcopy='fuzzy_edit copy'
# GUI editors resolve through the bash function wrappers in editor-launchers.js
# (they are not necessarily PATH binaries), which is why fuzzy_edit gates on
# is_runnable_command rather than `type -P`.
alias fzed='fuzzy_edit zed'
alias fsubl='fuzzy_edit subl'
alias fcode='fuzzy_edit code'

################################################################################
# --- Filter Functions ---
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
# --- Fuzzy List All ---
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
# Exported because _fuzzy_list_all passes all three straight to node as argv, and
# fzf's F5 reload re-invokes it inside a `$SHELL -c` subshell — unexported they
# arrive empty, JSON.parse('') throws, and the picker reloads to nothing.
export _IGNORED_FOLDERS_JSON _IGNORED_FILES_JSON _FUZZY_TEXT_FILES_JSON

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
  # Git fast path: when a directory is a git repo (has .git/), runs async
  # `git ls-files` / `git ls-tree` in parallel with the readdir BFS. For
  # `paths` mode only one git command runs (ls-files) and directories are
  # derived from file paths to avoid a second call. Nested git repos
  # discovered during BFS are processed in parallel via Promise.all. The
  # BFS keeps running alongside git output to surface untracked files
  # (e.g. brand-new files, `.env`, locally generated artifacts) that
  # `git ls-files` would miss; emit() dedups overlap via a Set. When root
  # is a git repo, BFS depth is capped at GIT_BFS_DEPTH (3) since the deep
  # tracked tree is already covered by git ls-files.
  #
  # Prefix filter (optional `filter` arg): when set, only top-level entries
  # whose name starts with `filter` are processed. This is the key perf
  # optimisation for tab-completion — e.g. `vim ~/.gi<tab>` passes dir="~/"
  # and filter=".gi", so only .git/, .github/, .gitconfig etc. are crawled
  # instead of the entire home directory. The filter is case-insensitive.
  # When filter is empty (fzf pickers like fvim), everything is listed.
  #
  # Self-terminates after max_timeout seconds (deadline-based).
  #
  # stdin and stderr MUST be detached from the terminal (see the redirects on
  # the closing line). At startup node snapshots the termios of every tty
  # among fd 0/1/2 and restores that snapshot when it exits (node::ResetStdio).
  # This lister runs as the producer half of `_fuzzy_list_all | fzf`, so node
  # starts a moment before fzf switches the terminal to raw mode, snapshots the
  # still-cooked termios, and on exit puts the terminal back into cooked mode
  # underneath the running fzf. The visible symptom is arrow keys echoing as
  # literal ^[[A / ^[[B into the fzf query instead of moving the selection.
  # The same applies to readline during fzf tab-completion. Only fd 1 (the pipe
  # to fzf) may stay attached.
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
    const emitted = new Set();
    function emit(rp) {
      if (emitted.has(rp)) return;
      emitted.add(rp);
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
    const queue = [{abs: dir, rel: '', depth: 0}];
    const gitPromises = [];
    // git fast path runs in parallel with BFS; emit() dedups overlap so
    // tracked files come from git ls-files (fast, full-depth) and
    // untracked/locally created files come from the readdir BFS.
    const rootIsGit = isGitRepo(dir);
    if (rootIsGit) gitPromises.push(emitGitRepo(dir, ''));
    // When root is a git repo, supplemental BFS only needs to surface
    // untracked files near the top — git ls-files already covers the deep
    // tracked tree. Cap BFS depth to keep this cheap in large repos.
    const GIT_BFS_DEPTH = 3;
    const bfsMaxDepth = rootIsGit ? Math.min(maxDepth, GIT_BFS_DEPTH) : maxDepth;
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
            gitPromises.push(emitGitRepo(path.join(abs, name), rp));
            // fall through — BFS into the nested repo too so untracked
            // files surface; emit() dedups against git ls-files output.
          }
          if (mode !== 'files' && mode !== 'text_files') emit(label);
          if (depth + 1 < bfsMaxDepth) queue.push({abs: path.join(abs, name), rel: rp, depth: depth + 1});
        } else {
          emit(label);
        }
      }
    }
    await Promise.all(gitPromises);
    })();
  " "$dir" "$mode" "$max_depth" "$_IGNORED_FOLDERS_JSON" "$_IGNORED_FILES_JSON" "$_FUZZY_TEXT_FILES_JSON" "$max_timeout" "$filter" < /dev/null 2> /dev/null
}
# fzf runs --bind reload(...) through `$SHELL -c`, which cannot see a
# non-exported shell function — without this the F5 rebind in fuzzy_cd and
# fuzzy_edit forks a subshell that dies with "command not found" and silently
# empties the picker. Same reason _fzf_info_line is exported below.
export -f _fuzzy_list_all

################################################################################
# --- FZF Functions ---
################################################################################
# dynamic info line for fzf - shows context-aware label based on prompt
# fzf runs --info-command through `$SHELL -c`, which cannot see a
# non-exported shell function, so this must be exported or every render
# forks a doomed subshell and the info line stays blank.
# Patterns must match the lowercase --prompt strings used by the pickers below.
function _fzf_info_line() {
  local label="results"
  case "$FZF_PROMPT" in
  *"edit>"*) label="paths" ;;
  *"cd>"*) label="folders" ;;
  *"commits>"*) label="commits" ;;
  *"bookmark>"*) label="bookmarks" ;;
  *"recent files>"*) label="recent files" ;;
  *"history>"*) label="commands" ;;
  "> "*) label="completions" ;;
  esac
  echo "$FZF_MATCH_COUNT of $FZF_TOTAL_COUNT $label"
}
export -f _fzf_info_line

# joins a picker selection back onto the base folder it was listed from.
#
# _fuzzy_list_all emits paths relative to its base folder, NOT to $PWD, so every
# consumer has to rejoin before the path means anything: the preview pane (fzf
# runs --preview through `$SHELL -c` inheriting the caller's $PWD), the cd
# target, and the editor target. Skipping the join is what made
# `fcat ~/_extra/ai_llm/plans/` render "[bat error]: ... No such file or
# directory" in the preview, and `fuzzy_cd ~/_extra` report "Path no longer
# exists: ai_llm/skills/" for a folder that does exist. Same prefix-merge the
# nested autocomplete does with _nested_prefix.
#
# Absolute and ~ selections pass through untouched — fuzzy_cd mixes absolute
# recent folders (★) into a list of base-relative subfolders.
function _fzf_resolve_path() {
  local base="${1:-.}" selection="${2:-}"
  [ -z "$selection" ] && return 0
  local target="$selection"
  [[ "$target" == \~* ]] && target="$HOME${target#\~}"
  [[ "$target" != /* ]] && target="${base%/}/${target#./}"
  echo "$target"
}
export -f _fzf_resolve_path

# preview pane renderer for paths emitted by _fuzzy_list_all — folders list,
# files render through bat. Must be exported for the same `$SHELL -c` reason as
# _fzf_info_line.
function _fzf_preview_path() {
  local target
  target=$(_fzf_resolve_path "${1:-.}" "${2:-}")
  [ -z "$target" ] && return 0
  if [ -d "$target" ]; then
    command ls -Cp --color=always "$target" 2> /dev/null
  else
    bat --paging=never --style=plain --color=always "$target"
  fi
}
export -f _fzf_preview_path

# fzf picker for recently opened files — opens selected file with view_file or optional editor arg
function fuzzy_recent_files() {
  local VIEW_COMMAND="${1:-}"
  local OUT=$(echo "$(_recent_files)" | fzf_run +m --prompt="recent files> " \
    --header="(Ctrl+Y) - recently opened files" \
    --preview="bat --paging=never --style=plain --color=always {}" \
    --preview-window=down:50%:wrap)
  if [ -n "$OUT" ] && [ -f "$OUT" ]; then
    # Gate on is_runnable_command, not `type -P` — GUI editors (zed, code, subl,
    # smerge) are bash function wrappers from editor-launchers.js, not PATH
    # binaries, so `type -P` silently fell through to view_file for them.
    local EDIT_CMD="view_file"
    if is_runnable_command "$VIEW_COMMAND"; then
      EDIT_CMD="$VIEW_COMMAND"
    fi
    print_action_summary "$OUT" "$EDIT_CMD"
    "$EDIT_CMD" "$OUT"
  fi
}

################################################################################
# --- FZF Advanced Helper Functions ---
################################################################################
# override view_file with editor
# Default GUI editor for every picker that isn't given an explicit editor arg
# (fuzzy_edit with no command, fuzzy_recent_files, autocomplete helpers).
# Candidates are tried in order via is_runnable_command so a host missing Zed
# still lands on a working editor instead of "command not found". Each name
# resolves to the bash function wrapper from editor-launchers.js when present,
# which is why `type -P` is not used here.
_VIEW_FILE_EDITORS=(zed subl code vim)
function view_file() {
  if [[ $# -eq 0 ]]; then
    return 1 # silent exit
  fi
  local editorCmd="" candidate
  for candidate in "${_VIEW_FILE_EDITORS[@]}"; do
    if is_runnable_command "$candidate"; then
      editorCmd="$candidate"
      break
    fi
  done
  if [ -z "$editorCmd" ]; then
    echo "view_file: no editor found (tried: ${_VIEW_FILE_EDITORS[*]})" >&2
    return 1
  fi
  print_action_summary "$1" "$editorCmd"
  "$editorCmd" "$1"
}

################################################################################
# --- FZF Advanced Helper Functions ---
################################################################################
# --- Bookmark Fzf Helper Functions ---
# Single source for the bookmark file location. Lives under the personal root
# ($SY_ROOT_FOLDER) so every piece of Sy-owned state sits in one folder.
BOOKMARK_SYLE_PATH="${SY_ROOT_FOLDER}/.syle_bookmark"

# view_bookmark - print the bookmark file
alias view_bookmark='command cat "$BOOKMARK_SYLE_PATH"'

# add_bookmark <command> [<command>...] - add one or more commands to the bookmark file
#
# Variadic on purpose: the whole body costs one subshell and one rewrite of the
# file regardless of how many entries are passed, so callers seeding a batch
# should pass them in a single call rather than looping. A loop of N calls pays
# N forks, and fork cost scales with the size of the surrounding environment --
# measured at ~1ms per call in a bare shell but ~7.6ms once a large profile is
# loaded, which made a 31-entry seeding loop cost ~236ms of shell startup.
function add_bookmark() {
  [ $# -eq 0 ] && return 0
  local content
  command mkdir -p "$(dirname "$BOOKMARK_SYLE_PATH")" 2> /dev/null
  content=$({
    printf '%s\n' "$@"
    command cat "$BOOKMARK_SYLE_PATH" 2> /dev/null
  } | sort -u)
  echo "$content" > "$BOOKMARK_SYLE_PATH"
}

function add_bookmark_dir() {
  dir="${1:-$(pwd)}"
  add_bookmark "cd $dir"
}

# Ctrl+B — fuzzy favorite command picker
function fuzzy_favorite_command() {
  local cmd
  cmd=$(command cat "$BOOKMARK_SYLE_PATH" 2> /dev/null | sort -u | fzf_run --prompt="bookmark> " \
    --header="(Ctrl+B) - bookmarked commands" \
    --preview='source "$HOME/.bashrc" &>/dev/null; cmd={};word=$(echo "$cmd" | awk "{print \$1}"); { type "$word" 2>&1; echo ""; echo "---"; echo "$cmd"; } | bat --paging=never --style=plain --color=always --language=bash' \
    --preview-window=down:50%:wrap \
    --bind 'f5:reload(command cat "$BOOKMARK_SYLE_PATH" 2>/dev/null | sort -u)')

  if [ -n "$cmd" ]; then
    echo "### Command Selected from Bookmarks ###"
    echo "$cmd"
    eval "$cmd"
    history -s "$cmd"
  fi
}

# --- File related Fzf Helper Functions ---
# Ctrl+P — fzf cd picker (PWD subfolders first, then recent folders marked with ★)
# Each line is "<marker>\t<path>"; fzf shows both columns but searches only the path
# (--nth=2). Selection extracts the path via "${OUT##*$'\t'}".
function _fuzzy_cd_list() {
  local dir="${1:-.}"
  _fuzzy_list_all "$dir" "folders" "" 10 | awk '{print "  \t" $0}'
  _recent_folders 2> /dev/null | awk '{print "★ \t" $0}'
}
# exported so the F5 reload subshell can resolve it (see _fuzzy_list_all)
export -f _fuzzy_cd_list
function fuzzy_cd() {
  local dir="${1:-.}"
  local abs_dir
  abs_dir=$(cd "$dir" 2> /dev/null && command pwd || echo "$dir")
  # base folder is interpolated into the fzf option strings because --preview and
  # --bind run in their own `$SHELL -c` subshells that never see these locals
  local base_q
  base_q=$(printf '%q' "$abs_dir")
  local OUT=$(_fuzzy_cd_list "$dir" | awk -F'\t' '!seen[$2]++' | fzf_run +m \
    --delimiter=$'\t' --with-nth=1,2 --nth=2 \
    --prompt="cd> " \
    --header="(Ctrl+P) - cd; ★ recent folders, plain = subfolders under ${abs_dir}" \
    --preview="_fzf_preview_path $base_q {2}" \
    --preview-window=down:50%:wrap \
    --bind "f5:reload(_fuzzy_cd_list $base_q | awk -F'\t' '!seen[\$2]++')")
  if [ -n "$OUT" ]; then
    OUT="${OUT##*$'\t'}"
    # subfolder entries are relative to "$abs_dir" while ★ recent folders are
    # already absolute — _fzf_resolve_path handles both
    local FULL_PATH
    FULL_PATH=$(_fzf_resolve_path "$abs_dir" "$OUT")
    if [ -d "$FULL_PATH" ]; then
      print_action_summary "$FULL_PATH"
      cd "$FULL_PATH"
    else
      echo "Path no longer exists: $FULL_PATH"
    fi
  fi
}

# Ctrl+T (vim) / Ctrl+Y (default editor) — fzf editor picker for files and directories
function fuzzy_edit() {
  local VIEW_COMMAND="$1"
  local dir="${2:-.}"
  local abs_dir
  abs_dir=$(cd "$dir" 2> /dev/null && command pwd || echo "$dir")
  # base folder is interpolated into the fzf option strings because --preview and
  # --bind run in their own `$SHELL -c` subshells that never see these locals
  local base_q
  base_q=$(printf '%q' "$abs_dir")
  local OUT=$(_fuzzy_list_all "$dir" "paths" "" 10 | fzf_run --prompt="edit> " \
    --header="(Ctrl+T) - edit files under ${abs_dir}" \
    --preview="_fzf_preview_path $base_q {}" \
    --preview-window=down:50%:wrap \
    --bind "f5:reload(_fuzzy_list_all $base_q 'paths' '' 10)")

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
  # _fuzzy_list_all emits paths relative to "$dir", so resolve the selection
  # against "$abs_dir" — not against PWD and not against the git toplevel.
  # Resolving from the git root left FULL_PATH empty (and leaked a "realpath:
  # No such file or directory" error) for every selection made from a
  # subdirectory of a repo, and handed the editor a path relative to the wrong
  # base whenever fuzzy_edit was called with an explicit "$dir".
  FULL_PATH=$(_fzf_resolve_path "$abs_dir" "$OUT")
  FULL_PATH=$(realpath "$FULL_PATH" 2> /dev/null) || FULL_PATH=$(_fzf_resolve_path "$abs_dir" "$OUT")

  # Folder selections: just print PWD + cd. File selections: also print the editor line
  # (mirrors what we're about to invoke). print_action_summary handles the format.
  if [ "$IS_DIR" = true ]; then
    print_action_summary "$FULL_PATH"
    cd "$FULL_PATH"
  else
    # `type -P` only resolves PATH binaries, so it missed every GUI editor
    # wrapper that editor-launchers.js defines as a bash function (zed, code,
    # subl, smerge). `fuzzy_edit zed` therefore fell through to view_file (i.e.
    # Sublime) on any host without a zed shim in PATH. is_runnable_command also
    # accepts shell functions and builtins.
    local EDIT_CMD="view_file"
    if is_runnable_command "$VIEW_COMMAND"; then
      EDIT_CMD="$VIEW_COMMAND"
    fi
    print_action_summary "$FULL_PATH" "$EDIT_CMD"
    "$EDIT_CMD" "$FULL_PATH"
  fi
}

# Ctrl+N — interactive git log browser with commit preview
function fuzzy_git_show() {
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always \
    | fzf_run --prompt="commits> " \
      --header="(Ctrl+N) - git log; Enter shows full commit in pager, F5 reloads" \
      --preview-window=down:50%:wrap \
      --preview='hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | head -1);
      git log --color=always --format="%C(yellow)%H%n%C(cyan)Author: %an <%ae>%n%C(green)Date:   %ad%n%n%C(bold white)%s%C(reset)%n%n%b" -1 $hash;
      echo "$LINE_BREAK_HASH";
      git diff-tree --no-commit-id --stat --color=always $hash;
      echo "";
      git diff-tree --no-commit-id -p --color=always $hash' \
      --bind "ctrl-m:execute:(echo {} | grep -o '[a-f0-9]\{7\}' | head -1 | xargs -I % sh -c 'git show --color=always % | (bat --paging=always --style=plain 2>/dev/null || batcat --paging=always --style=plain 2>/dev/null || less -R)')" \
      --bind "f5:reload(git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always)"
}

################################################################################
# --- Register case-insensitive picker variants ---
# Last statement in this partial on purpose: every picker function and alias
# above must already exist for the generator to see it.
################################################################################
fzf_register_case_variants
