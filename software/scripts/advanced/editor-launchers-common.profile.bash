#!/usr/bin/env bash

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
    (nohup "$target_binary" "${editor_args[@]}" > /dev/null 2>&1 &)
    # bring the editor window to the foreground on macOS
    if ((is_os_mac)); then
      local app_name=""
      case "$editor_name" in
      subl) app_name="Sublime Text" ;;
      smerge) app_name="Sublime Merge" ;;
      code) app_name="Visual Studio Code" ;;
      zed) app_name="Zed" ;;
      esac
      if [[ -n "$app_name" ]]; then
        osascript \
          -e "tell application \"$app_name\" to activate" \
          -e "tell application \"System Events\" to tell process \"$app_name\" to set position of window 1 to {0, 0}" \
          -e "tell application \"Finder\" to set {_, _, sw, sh} to bounds of window of desktop" \
          -e "tell application \"System Events\" to tell process \"$app_name\" to set size of window 1 to {sw, sh}" \
          2> /dev/null &
      fi
    fi
  fi

  local dir=""
  if [[ -n "$unresolved_path" ]]; then
    dir=$(dirname "$unresolved_path")
  fi

  local path_info="Path:          $unresolved_path"
  if [[ "$unresolved_path" != "$resolved_path" ]] && [[ -n "$resolved_path" ]]; then
    path_info+=$'\n'"Resolved Path: $resolved_path"
  fi

  echo "
====================================
\"$target_binary\" ${editor_args[@]}
PWD:           $(pwd)
Dir:           $dir
$path_info
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
