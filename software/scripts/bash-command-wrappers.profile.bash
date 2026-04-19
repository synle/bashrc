#!/usr/bin/env bash

################################################################################
# ---- Command Wrappers ----
#
# --- SQLite ---
# sqlite        — Wrapper: prefers sqlite3, falls back to sqlite
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
# Lazy-activation wrappers shadow the real binaries so the first invocation
# triggers setup (e.g. activating a venv or fnm), then delegates to the
# real command. Sourced AFTER spec-based autocomplete.
################################################################################

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
