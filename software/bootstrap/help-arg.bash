#!/usr/bin/env bash
# Shared help predicate for bootstrap, installer scripts, and interactive profiles.

# is_help_arg <arg>: return 0 for a help request, otherwise 1, including missing input.
# Recognizes help, --help, -help, /help, -h, ?, -?, and /? case-insensitively; prints nothing.
# Use tr for Bash 3.2 and quote question-mark patterns so they cannot match arbitrary characters.
function is_help_arg() {
  local arg
  arg=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
  case "$arg" in
  help | --help | -help | /help | -h | '?' | '-?' | '/?') return 0 ;;
  *) return 1 ;;
  esac
}
