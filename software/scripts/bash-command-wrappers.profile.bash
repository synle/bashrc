#!/usr/bin/env bash

################################################################################
# ---- Command Wrappers ----
#
# --- su ---
# su            — Wrapper: no args opens root shell preserving $PATH (sudo -E bash),
#                 with args falls back to regular su
#
# --- SQLite ---
# sqlite        — Wrapper: prefers sqlite3, falls back to sqlite
#
# --- bat ---
# bat           — Wrapper: chains bat -> batcat -> cat so callers can always
#                 use the canonical `bat` name. Pins --theme=ansi so highlighting
#                 uses the terminal's 16-color ANSI palette (legible on any
#                 background, especially inside fzf preview panes).
#
# --- Python ---
# activate_py   — Activate Python venv if not already active
# python        — Lazy wrapper: activates venv on first use, then delegates
# pip           — Smart wrapper: uses uv pip in uv venvs, pip3 fallback
#
# --- Node / NPM ---
# activate_node — Activate node via fnm (default version) or system node
# node          — Lazy wrapper: activates fnm on first use, then delegates
# npm           — Smart wrapper: bare args run as "npm run <name>"
# yarn          — Smart wrapper: falls back to npm if yarn unavailable
# renpm         — Delete node_modules and reinstall (yarn/npm ci/npm install)
#
# --- Language package upgrades ---
# update_lang   — Upgrade global packages from each language pkg manager on PATH
#                 (rustup, cargo-update, npm, pnpm, yarn, bun, deno, uv, pip).
#                 Companion to the `update` alias which only handles OS pkg managers.
#
# --- Git ---
# blame         — git blame alternative: per-line "<line>  <cmt> <date> <sha>
#                 <author>: <summary>" for each input file, with a
#                 "<cmt> file: <abs-path>" comment-style header on top
#                 (absolute path of the input, resolved via realpath).
#                 <cmt> is "//" for C-family extensions
#                 (js/ts/jsx/tsx/c/cc/cpp/h/hpp/java/cs/go/rs/swift/kt/scala/
#                 m/mm/dart/php/proto/gradle/groovy/sass/scss/less) and "#"
#                 otherwise — keeps each row paste-safe as a comment in the
#                 host language.
# blame_view    — runs `blame` and opens it in the editor: writes the blame
#                 output to /tmp/<YYYYMMDD-HHMMSS>-<flattened-abs-path>
#                 (input's absolute path with "/" and "\" flattened to "_",
#                 e.g. "home_syle_git_bashrc_run.sh", extension preserved so
#                 the editor picks the right syntax), then opens the temp
#                 file with subl (the default editor).
#
# Lazy-activation wrappers shadow the real binaries so the first invocation
# triggers setup (e.g. activating a venv or fnm), then delegates to the
# real command. Sourced AFTER spec-based autocomplete.
################################################################################

################################################################################
# ---- su ----
################################################################################
# su: root shell preserving PATH and env
function su() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "su: root shell preserving \$PATH (sudo -E bash)"
    echo "  su          open root shell with your env/PATH preserved"
    echo "  su <args>   fall back to regular su with args"
    return
  fi
  if [ $# -eq 0 ]; then
    sudo -E bash
  else
    command su "$@"
  fi
}

################################################################################
# ---- SQLite ----
################################################################################
function sqlite() {
  if type -P sqlite3 &> /dev/null; then
    command sqlite3 "$@"
  elif type -P sqlite &> /dev/null; then
    command sqlite "$@"
  else
    echo "sqlite: not installed"
  fi
}

################################################################################
# ---- bat ----
################################################################################
# bat: canonical entry point for syntax-highlighted file/stdin viewing. Chains
# bat -> batcat -> cat so callers (interactive shells, fzf previews, scripts)
# can always invoke `bat` regardless of which binary is actually installed.
# Pins --theme=ansi for the bat/batcat path so highlighting uses the terminal's
# 16-color ANSI palette (legible on any background, especially inside fzf
# preview panes); user-supplied --theme=... still wins because bat applies the
# last occurrence of repeated flags. Exported so fzf preview subshells (which
# don't source ~/.bashrc) inherit the wrapper too.
function bat() {
  if type -P bat &> /dev/null; then
    command bat --theme=ansi "$@"
  elif type -P batcat &> /dev/null; then
    command batcat --theme=ansi "$@"
  else
    command cat "$@"
  fi
}
export -f bat

################################################################################
# ---- Python ----
################################################################################
function activate_py() {
  type -P python &> /dev/null && return
  if [[ -z "$VIRTUAL_ENV" ]]; then
    local venv_candidates=(
      "./.venv/bin/activate"
      "./venv/bin/activate"
      "$HOME/.venv/bin/activate"
      "$HOME/venv/bin/activate"
    )
    local venv_activate
    venv_activate=$(find_path "${venv_candidates[@]}" --file) && safe_source "$venv_activate"
  fi
}

function python() {
  if ! type -P python &> /dev/null; then
    activate_py
  fi
  command python "$@"
}

function pip() {
  activate_py
  if [ -n "$VIRTUAL_ENV" ] && grep -q "^uv" "$VIRTUAL_ENV/pyvenv.cfg" 2> /dev/null && type -P uv &> /dev/null; then
    command uv pip "$@"
  elif type -P pip3 &> /dev/null; then
    command pip3 "$@"
  elif type -P pip &> /dev/null; then
    command pip "$@"
  else
    echo "pip: not installed"
  fi
}
alias pip3='pip'

################################################################################
# ---- Node / NPM ----
################################################################################
# activates node via fnm (Fast Node Manager) with its default version, or falls back to system node.
# usage:
#   activate_node        - use fnm's default node version (preferred)
#   activate_node 1      - skip fnm, use system-installed node directly
function activate_node() {
  local use_system="${1-}"
  if [ "$use_system" != "1" ] && [ "$use_system" != "true" ] && type -P fnm &> /dev/null; then
    eval "$(fnm env)" 2> /dev/null
    local default_version
    default_version=$(fnm ls 2> /dev/null | grep -i "default" | grep -o "v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*")
    if [ -n "$default_version" ]; then
      echo "activate_node: fnm node $default_version ($(fnm exec --using="$default_version" type -P node 2> /dev/null))"
      fnm use "$default_version" &> /dev/null
    fi
  else
    local node_path
    node_path=$(type -P node 2> /dev/null)
    if [ -n "$node_path" ]; then
      echo "activate_node: node found at $node_path"
      if [ -L "$node_path" ]; then
        echo "activate_node: symlink target $(readlink -f "$node_path")"
      fi
    fi
  fi
}

# lazy wrapper: activates node on first use if not already available, then delegates to the real binary.
function node() {
  if ! type -P node &> /dev/null; then
    activate_node
  fi
  command node "$@"
}

# checks if a script name exists in ./package.json (excludes built-in npm subcommands)
function _has_pkg_script() {
  case "$1" in
  access | adduser | audit | bugs | cache | ci | completion | config | dedupe | deprecate | diff | dist-tag | docs | doctor | edit | exec | explain | explore | find-dupes | fund | get | help | hook | init | install | install-ci-test | install-test | link | ll | login | logout | ls | org | outdated | owner | pack | ping | pkg | prefix | profile | prune | publish | query | rebuild | repo | restart | root | run | sbom | search | set | shrinkwrap | star | stars | start | stop | team | test | token | uninstall | unpublish | unstar | update | version | view | whoami) return 1 ;;
  esac
  [ -f package.json ] && node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2> /dev/null
}

# wraps npm so bare subcommand names run as `npm run <name>`
function npm() {
  if [ -n "${1-}" ] && [[ "${1-}" != -* ]] && _has_pkg_script "$1"; then
    command npm run "$@"
  else
    command npm "$@"
  fi
}

# wraps yarn so bare subcommand names run as `yarn run <name>`, falls back to npm
function yarn() {
  if type -P yarn &> /dev/null && command yarn --version &> /dev/null; then
    if [ -n "${1-}" ] && [[ "${1-}" != -* ]] && _has_pkg_script "$1"; then
      command yarn run "$@"
    else
      command yarn "$@"
    fi
  else
    npm "$@"
  fi
}

function renpm() {
  rm -rf node_modules
  if [ -f yarn.lock ]; then
    yarn install
  elif [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
}

################################################################################
# ---- Language package upgrades ----
################################################################################
# update_lang: upgrade globally-installed packages from each language pkg manager
function update_lang() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "update_lang: upgrade globally-installed language packages
  Skips any tool not on PATH. Companion to the OS-level \`update\` alias.
  Covers: rustup, cargo-update, npm, pnpm, yarn (v1), bun, deno, uv, pip (--user)."
    return 0
  fi

  echo ">>> Upgrading global language packages"

  # rust toolchain (rustc/cargo themselves)
  if type -P rustup &> /dev/null; then
    echo ">> rustup update"
    rustup update
  fi

  # cargo install-update (requires `cargo install cargo-update` first; skipped if absent)
  if type -P cargo &> /dev/null && cargo install --list 2> /dev/null | grep -q '^cargo-update '; then
    echo ">> cargo install-update -a"
    cargo install-update -a
  fi

  # npm globals
  if type -P npm &> /dev/null; then
    echo ">> npm update -g"
    npm update -g
  fi

  # pnpm globals
  if type -P pnpm &> /dev/null; then
    echo ">> pnpm update -g"
    pnpm update -g
  fi

  # yarn v1 globals (yarn berry/v2+ has no `global upgrade`)
  if type -P yarn &> /dev/null && yarn --version 2> /dev/null | grep -q '^1\.'; then
    echo ">> yarn global upgrade"
    yarn global upgrade
  fi

  # bun runtime + globals
  if type -P bun &> /dev/null; then
    echo ">> bun upgrade"
    bun upgrade
  fi

  # deno runtime
  if type -P deno &> /dev/null; then
    echo ">> deno upgrade"
    deno upgrade
  fi

  # uv tool installs
  if type -P uv &> /dev/null; then
    echo ">> uv tool upgrade --all"
    uv tool upgrade --all
  fi

  # pip --user packages (skip system site-packages)
  if type -P pip &> /dev/null; then
    echo ">> pip user packages"
    local outdated
    outdated=$(pip list --outdated --user 2> /dev/null | awk 'NR>2 {print $1}')
    if [ -n "$outdated" ]; then
      echo "$outdated" | xargs pip install --user --upgrade
    else
      echo "   (nothing to upgrade)"
    fi
  fi

  echo ">>> update_lang done"
}

################################################################################
# ---- Git ----
################################################################################
# blame: git blame alternative — print per-line "<line>  <cmt> <date> <sha> <author>: <summary>"; <cmt> is "//" for C-family extensions and "#" otherwise so the row is paste-safe as a comment in the host language
function blame() {
  if [ $# -eq 0 ] || [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "blame: git blame alternative — per-line history for each input file
  Usage: blame <file> [<file> ...]
  Output: prints a '<cmt> file: <abs-path>' comment-style header (absolute path of the input), then one row per line as
          <line content>  <cmt> <YYYY-MM-DD> <short sha> <author>: <commit summary>
          <cmt> is '//' for C-family extensions (js/ts/jsx/tsx/c/cc/cpp/h/hpp/java/cs/go/rs/swift/kt/scala/m/mm/dart/php/proto/gradle/groovy/sass/scss/less) and '#' otherwise.
  See also: blame_view — runs blame, writes to /tmp/<timestamp>-<flattened-abs-path>, and opens with subl."
    return
  fi

  if ! type -P git &> /dev/null; then
    echo "blame: git is not installed" >&2
    return 1
  fi

  local file dir base ext cmt abs
  for file in "$@"; do
    if [ ! -f "$file" ]; then
      echo "blame: not a file: $file" >&2
      continue
    fi
    dir=$(dirname -- "$file")
    if ! git -C "$dir" rev-parse --git-dir &> /dev/null; then
      echo "blame: $file is not in a git repo" >&2
      continue
    fi
    # resolve to an absolute path so the header always shows where the file lives,
    # regardless of the cwd the user ran blame from. fall back to "$file" if realpath fails.
    abs=$(realpath -- "$file" 2> /dev/null) || abs="$file"
    # pick the comment marker by file extension: "//" for C-family, "#" otherwise.
    # extension is taken from the basename's last "."; files without a "." fall through to "#".
    base=${file##*/}
    ext=${base##*.}
    [ "$ext" = "$base" ] && ext=""
    # lowercase via tr (bash 3.2 has no ${var,,})
    ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
    case "$ext" in
    js | jsx | mjs | cjs | ts | tsx | c | cc | cpp | cxx | h | hpp | hh | hxx | java | cs | go | rs | swift | kt | kts | scala | m | mm | dart | php | proto | gradle | groovy | sass | scss | less)
      cmt="//"
      ;;
    *)
      cmt="#"
      ;;
    esac
    echo "$cmt file: $abs"
    git blame --line-porcelain -- "$file" 2> /dev/null | command awk -v cmt="$cmt" '
      # SHA header line: "<40+ hex sha> <orig-line> <final-line> [num-lines]" — only first token of a per-line block
      /^[0-9a-f]{40,} / && header == 0 {
        sha = substr($1, 1, 7)
        header = 1
        next
      }
      # author <name> (note: author-mail / author-time / author-tz have a hyphen, so they will not match)
      /^author / {
        sub(/^author /, "")
        author = $0
        next
      }
      /^author-time / {
        atime = $2
        next
      }
      /^summary / {
        sub(/^summary /, "")
        summary = $0
        next
      }
      # the actual source line is prefixed by a single TAB
      /^\t/ {
        line = substr($0, 2)
        # cache date per sha — BSD (date -r) and GNU (date -d @) both covered by the || fallback
        if (sha in date_cache) {
          date = date_cache[sha]
        } else {
          cmd = "date -r " atime " +%Y-%m-%d 2>/dev/null || date -d @" atime " +%Y-%m-%d"
          cmd | getline date
          close(cmd)
          date_cache[sha] = date
        }
        printf "%s  %s %s %s %s: %s\n", line, cmt, date, sha, author, summary
        header = 0
      }
    '
  done
}

# blame_view: run blame on each file, write the output to /tmp/<timestamp>-<basename> (extension preserved so the editor picks the right syntax from the filename), then open with subl (the default editor)
function blame_view() {
  if [ $# -eq 0 ] || [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "blame_view: run blame and open it in the editor
  Usage: blame_view <file> [<file> ...]
  Behavior: for each input file, runs 'blame <file>' and writes the output to
            /tmp/<YYYYMMDD-HHMMSS>-<flattened-abs-path>, where the flattened
            path is the input's absolute path with leading '/' stripped and
            remaining '/' or '\\' replaced by '_' (so the temp filename encodes
            where the original came from, e.g. 'home_syle_git_bashrc_run.sh').
            The original extension stays at the end so the editor picks the
            right syntax. Then opens the temp file with subl (the default
            editor). Prints the temp-file path before opening."
    return
  fi

  local file abs flat ts out outs
  ts=$(date +%Y%m%d-%H%M%S)
  outs=()
  for file in "$@"; do
    if [ ! -f "$file" ]; then
      echo "blame_view: not a file: $file" >&2
      continue
    fi
    # resolve to an absolute path, then flatten so the temp filename encodes the
    # original location: "/home/syle/git/bashrc/run.sh" -> "home_syle_git_bashrc_run.sh".
    # strip the leading "/" first to avoid a leading "_"; replace both "/" and "\"
    # so WSL/Windows paths flatten too. extension stays at the end so the editor
    # picks the right syntax from the filename.
    abs=$(realpath -- "$file" 2> /dev/null) || abs="$file"
    flat=${abs#/}
    flat=${flat//\//_}
    flat=${flat//\\/_}
    out="/tmp/${ts}-${flat}"
    blame "$file" > "$out"
    echo "blame_view: wrote $out"
    outs+=("$out")
  done
  if [ "${#outs[@]}" -gt 0 ]; then
    subl "${outs[@]}"
  fi
}
