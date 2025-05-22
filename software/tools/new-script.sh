#!/usr/bin/env bash
{
  ################################################################################
  # ---- new-script.sh - Scaffold a new script file ----
  #
  # Usage:
  #   bash software/tools/new-script.sh name=my-tool     # Cross-platform script
  #   bash software/tools/new-script.sh name=my-tool os=mac # OS-specific script
  #   make new-script name=my-tool                     # Via Makefile
  #   make new-script name=my-tool os=mac              # Via Makefile
  #
  # Valid os values: android_termux, arch_linux, chromeos, mac, mingw64,
  #   redhat, steamos, ubuntu, windows, wsl
  ################################################################################

  _name=""
  _os=""

  # ---- Parse arguments ----
  for arg in "$@"; do
    case "$arg" in
    name=*) _name="${arg#name=}" ;;
    os=*) _os="${arg#os=}" ;;
    esac
  done

  if [ -z "$_name" ]; then
    echo "Usage: make new-script name=<script-name> [os=<os-name>]"
    echo ""
    echo "Examples:"
    echo "  make new-script name=my-tool"
    echo "  make new-script name=my-tool os=mac"
    echo ""
    echo "Valid os values:"
    echo "  android_termux, arch_linux, chromeos, mac, mingw64,"
    echo "  redhat, steamos, ubuntu, windows, wsl"
    exit 1
  fi

  # ---- Validate OS ----
  _valid_os="android_termux arch_linux chromeos mac mingw64 redhat steamos ubuntu windows wsl"
  if [ -n "$_os" ]; then
    _os_valid=false
    for _v in $_valid_os; do
      if [ "$_os" = "$_v" ]; then
        _os_valid=true
        break
      fi
    done
    if [ "$_os_valid" = "false" ]; then
      echo "Error: Invalid os '$_os'"
      echo "Valid values: $_valid_os"
      exit 1
    fi
  fi

  # ---- Determine output path ----
  if [ -n "$_os" ]; then
    _dir="software/scripts/$_os"
    _file="$_dir/$_name.js"
  else
    _dir="software/scripts"
    _file="$_dir/$_name.js"
  fi

  # ---- Check if file already exists ----
  if [ -f "$_file" ]; then
    echo "Error: $_file already exists"
    exit 1
  fi

  # ---- Ensure directory exists ----
  mkdir -p "$_dir"

  # ---- Generate readable description from name ----
  _description=$(echo "$_name" | sed 's/-/ /g' | sed 's/_/ /g')

  # ---- Build OS flag for guard function ----
  _guard_line=""
  if [ -n "$_os" ]; then
    _os_flag="is_os_$_os"
    _guard_line="  exitIfUnsupportedOs(\"$_os_flag\");"
  fi

  # ---- Write the scaffold ----
  if [ -n "$_guard_line" ]; then
    cat > "$_file" << 'OUTER'
/** Installs and configures DESCRIPTION. */
async function doWork() {
GUARD
  log(">> Setting up DESCRIPTION");

  // TODO: implement
}

/** Removes DESCRIPTION configuration. */
async function undoWork() {
GUARD
  log(">> Removing DESCRIPTION");

  // TODO: implement
}
OUTER
    # Replace placeholders
    sed -i.bak "s|DESCRIPTION|$_description|g" "$_file"
    sed -i.bak "s|GUARD|$_guard_line|g" "$_file"
    rm -f "$_file.bak"
  else
    cat > "$_file" << OUTER
/** Installs and configures $_description. */
async function doWork() {
  log(">> Setting up $_description");

  // TODO: implement
}

/** Removes $_description configuration. */
async function undoWork() {
  log(">> Removing $_description");

  // TODO: implement
}
OUTER
  fi

  echo "Created: $_file"
  echo ""
  echo "Next steps:"
  echo "  1. Edit $_file to implement doWork() and undoWork()"
  echo "  2. Test: bash run.sh --files=\"$_name.js\""
  echo "  3. Run: make format"

  exit
}
