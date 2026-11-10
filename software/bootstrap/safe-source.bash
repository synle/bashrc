#!/usr/bin/env bash
# Shared bootstrap loader; redefining helpers preserves per-process source and recursion state.

# _safe_source_resolve <file>: print a physical absolute filename, resolving at most 40 links.
# Returns nonzero for inaccessible folders, unreadable links, cycles, or protected paths without reading script contents.
function _safe_source_resolve() (
  local target="$1" folder link
  local links=0 max_links=40
  case "$target" in
  /*) ;;
  *) target="$PWD/$target" ;;
  esac
  while :; do
    case "$target" in *.secret.*) return 1 ;; esac
    folder="$(cd -P -- "${target%/*}" 2> /dev/null && pwd -P)" || return 1
    target="$folder/${target##*/}"
    case "$target" in *.secret.*) return 1 ;; esac
    if [ ! -L "$target" ]; then
      printf '%s\n' "$target"
      return 0
    fi
    [ "$links" -lt "$max_links" ] || return 1
    link="$(command readlink "$target")" || return 1
    case "$link" in
    /*) target="$link" ;;
    *) target="$folder/$link" ;;
    esac
    links=$((links + 1))
  done
)

# _safe_source_contains <identity> [identities...]: return 0 for a matching identity, otherwise 1.
function _safe_source_contains() {
  local identity="$1" candidate
  shift
  for candidate; do
    [ "$candidate" != "$identity" ] || return 0
  done
  return 1
}

# _safe_source_remember <identity>: record a successful canonical path or URL without duplicating registry entries.
function _safe_source_remember() {
  _safe_source_contains "$1" ${_SY_SAFE_SOURCE_LOADED[@]+"${_SY_SAFE_SOURCE_LOADED[@]}"} || _SY_SAFE_SOURCE_LOADED+=("$1")
}

# safe_source: source a syntax-checked script once per Bash process; see --help for usage.
# Returns 0 for successful or skipped loads, 2 for invalid arguments, otherwise the failure status.
function safe_source() {
  if [ "${1:-}" = --help ]; then
    printf '%s\n' 'safe_source: source a syntax-checked script once per Bash process.
Usage: safe_source [--reload] <source> [dest]
Use --reload for intentional repeat execution, such as virtual-environment activation.
Protected .secret. paths are never sourced. Failed sources can be retried.'
    return 0
  fi
  local reload=0
  if [ "${1:-}" = --reload ]; then
    reload=1
    shift
  fi
  if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ -z "$1" ]; then
    printf '%s\n' '[Warning] safe_source expects [--reload] <source> [dest]' >&2
    return 2
  fi
  local src="$1" dest="${2:-}" target="$1" key status active_index syntax_bash
  case "$src$dest" in
  *.secret.*)
    printf '%s\n' '[Warning] safe_source refused a protected path' >&2
    return 1
    ;;
  esac
  case "$src" in
  http://* | https://*) key="url:$src" ;;
  *)
    key="$(_safe_source_resolve "$src")" || {
      printf '%s\n' '[Warning] safe_source cannot resolve an eligible local file' >&2
      return 1
    }
    ;;
  esac
  if _safe_source_contains "$key" ${_SY_SAFE_SOURCE_ACTIVE[@]+"${_SY_SAFE_SOURCE_ACTIVE[@]}"}; then
    printf '%s\n' '[Warning] safe_source skipped a recursive source' >&2
    return 0
  fi
  if [ "$reload" -eq 0 ] && _safe_source_contains "$key" ${_SY_SAFE_SOURCE_LOADED[@]+"${_SY_SAFE_SOURCE_LOADED[@]}"}; then
    case "$key" in
    url:*) printf '%s\n' '[Warning] safe_source skipped an already loaded URL' >&2 ;;
    *) printf '[Warning] safe_source skipped already loaded script: %s\n' "$key" >&2 ;;
    esac
    return 0
  fi
  if [ -n "$dest" ]; then
    target="$(_safe_source_resolve "$dest")" || {
      printf '%s\n' '[Warning] safe_source cannot resolve an eligible destination' >&2
      return 1
    }
  fi
  case "$src" in
  http://* | https://*)
    if [ -z "$dest" ]; then
      target="$(_safe_source_resolve "${TMPDIR:-/tmp}/bashrc_safe_source_$$.sh")" || {
        printf '%s\n' '[Warning] safe_source cannot resolve an eligible download destination' >&2
        return 1
      }
    fi
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      printf '%s\n' '[Warning] safe_source download failed' >&2
      return 1
    }
    ;;
  *)
    [ -n "$dest" ] || target="$key"
    [ -f "$key" ] || {
      printf '%s\n' '[Warning] safe_source file not found' >&2
      return 1
    }
    if [ -n "$dest" ] && [ "$key" != "$target" ]; then
      command cp "$key" "$target" 2> /dev/null || {
        printf '%s\n' '[Warning] safe_source copy failed' >&2
        return 1
      }
    fi
    ;;
  esac
  syntax_bash=/bin/bash
  [ -x "$syntax_bash" ] || syntax_bash="$(type -P bash)" || return 1
  BASH_ENV= "$syntax_bash" -n "$target" 2> /dev/null || {
    printf '%s\n' '[Warning] safe_source syntax validation failed' >&2
    return 1
  }
  declare -p _SY_SAFE_SOURCE_ACTIVE > /dev/null 2>&1 || _SY_SAFE_SOURCE_ACTIVE=()
  active_index=${#_SY_SAFE_SOURCE_ACTIVE[@]}
  _SY_SAFE_SOURCE_ACTIVE[active_index]="$key"
  . "$target"
  status=$?
  unset '_SY_SAFE_SOURCE_ACTIVE[active_index]'
  if [ "$status" -eq 0 ]; then
    _safe_source_remember "$key"
  fi
  return "$status"
}
