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

  # Split editor_args into the first path-like arg (the display target) and the
  # remaining flags. Convert any path-like arg through to_windows_path so the actual
  # invocation works on WSL where the editor binary is the Windows-side process.
  local converted_args=()
  local first_path=""
  local -a flag_args=()
  for arg in "${editor_args[@]}"; do
    if [[ "$arg" == /* ]] || [[ "$arg" == .* ]]; then
      [ -z "$first_path" ] && first_path=$(realpath "$arg")
      converted_args+=("$(to_windows_path "$arg")")
    else
      converted_args+=("$arg")
      flag_args+=("$arg")
    fi
  done

  if ((is_os_windows)); then
    (nohup "$target_binary" "${converted_args[@]}" > /dev/null 2>&1 &)
  else
    (nohup "$target_binary" "${editor_args[@]}" > /dev/null 2>&1 &)
    # bring the editor window to the foreground on macOS (async, never blocks the shell)
    if ((is_os_mac)); then
      local app_name=""
      case "$editor_name" in
      subl) app_name="Sublime Text" ;;
      smerge) app_name="Sublime Merge" ;;
      code) app_name="Visual Studio Code" ;;
      zed) app_name="Zed" ;;
      esac
      if [[ -n "$app_name" ]]; then
        (maximize_and_focus_window "$app_name" > /dev/null 2>&1 &)
      fi
    fi
  fi

  if [ -n "$first_path" ]; then
    print_action_summary "$first_path" "$target_binary" "${flag_args[@]}"
  fi
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
