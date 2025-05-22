#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Resolve editor binary from a list of candidate paths (delegates to find_path exec mode)
function find_editor() {
  local editor_name="$1"
  shift
  local result
  result=$(find_path "$@" --exec) && echo "$result" && return 0
  echo "Error: $editor_name not found in search paths." >&2
  return 1
}

# Launch an editor in the background (GUI mode)
function run_editor() {
  local editor_name="$1"
  shift
  local target_binary
  target_binary=$(find_editor "$editor_name" "$@") || return 1

  # track opened files for recent file history
  type _track_file &> /dev/null && _track_file "${editor_args[@]}"

  # Prepare a new array for the converted paths
  local converted_args=()
  local unresolved_path=""
  local resolved_path=""

  for arg in "${editor_args[@]}"; do
    # Check if the argument is a path (starts with / or .)
    if [[ "$arg" == /* ]] || [[ "$arg" == .* ]]; then
      unresolved_path=$(realpath "$arg")
      if ((is_os_windows)); then
        resolved_path=$(wslpath -m "$arg")
      else
        resolved_path="$unresolved_path"
      fi
      converted_args+=("$resolved_path")
    else
      converted_args+=("$arg")
    fi
  done

  if ((is_os_windows)); then
    # Use the converted_args here
    (nohup "$target_binary" "${converted_args[@]}" > /dev/null 2>&1 &)
  else
    # If not a Windows window, you might still want standard args
    # or the same conversion depending on your setup
    (nohup "$target_binary" "${editor_args[@]}" > /dev/null 2>&1 &)
  fi

  local dir=""
  if [[ -n "$unresolved_path" ]]; then
    dir=$(dirname "$unresolved_path")
  fi

  echo "
====================================
\"$target_binary\" ${editor_args[@]}
PWD:           $(pwd)
Dir:           $dir
Path:          $unresolved_path
Resolved Path: $resolved_path
====================================
  "
}

# Run an editor command in the foreground (CLI mode, stdout preserved)
function run_editor_cli() {
  local editor_name="$1"
  shift
  local target_binary
  target_binary=$(find_editor "$editor_name" "${editor_paths[@]}") || return 1

  # track opened files for recent file history
  type _track_file &> /dev/null && _track_file "$@"

  "$target_binary" "$@"
}
