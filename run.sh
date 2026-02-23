#! /bin/sh

# run.sh - Unified test runner script
#
# Usage:
#   sh run.sh                                    # Full run, local mode (default)
#   sh run.sh --mode=prod                        # Full run, prod mode (curl from upstream)
#   sh run.sh --prod                             # Shorthand for --mode=prod
#   sh run.sh --local                            # Shorthand for --mode=local
#   sh run.sh --dev                              # Shorthand for --mode=local
#   sh run.sh --files="git.js"                   # Test specific file(s), local mode
#   sh run.sh --mode=prod --files="git.js"       # Test specific file(s), prod mode
#   sh run.sh --files="vim.js,git.js"            # Multiple files (comma-separated)
#   sh run.sh --files="""                        # Multiple files (multiline)
#     vim.js
#     git.js
#     vundle.js
#   """
#   sh run.sh git.js                             # Bare args treated as files
#   sh run.sh git.js vim.js                      # Multiple bare args
#   sh run.sh --prod git.js vim.js               # Mix flags and bare file args
#   sh run.sh --pre-scripts="foo.sh,bar.sh"      # Run shell scripts via | bash before main run
#   sh run.sh --pre-scripts="""                  # Multiline pre-scripts
#     foo.sh
#     bar.sh
#   """
#   sh run.sh --run-only-prescripts              # Only run pre-scripts, skip main run
#   sh run.sh --force-refresh                    # Force remove and reinstall nvm
#   sh run.sh --lightweight                      # Export LIGHT_WEIGHT_MODE=1 for lightweight installs
#
# Single dash also works: -prod, -local, -dev, -mode=..., -files=..., -pre-scripts=..., -run-only-prescripts, -force-refresh, -lightweight

##########################################################
# Prerequisites - OS Flags & NVM/Node Setup
##########################################################
export BASH_SYLE_COMMON='~/.bash_syle_common'
export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/synle/bashrc/master"

BASH_SYLE_COMMON_PATH=$(eval echo $BASH_SYLE_COMMON)

# Initialize common file with OS detection flags
if [ ! -f "$BASH_SYLE_COMMON_PATH" ]; then
  cat << 'EOF' > "$BASH_SYLE_COMMON_PATH"
##########################################################
# OS Detection
##########################################################
export is_os_darwin_mac=0 && [ -d /Applications ] && export is_os_darwin_mac=1
export is_os_ubuntu=0 && command grep -Eiq "ID(_LIKE)?=(ubuntu|debian|mint)" /etc/os-release 2>/dev/null && export is_os_ubuntu=1
export is_os_chromeos=0 && { [ -f /dev/.cros_milestone ] || grep -qi cros /proc/version 2>/dev/null; } && export is_os_chromeos=1
export is_os_mingw64=0 && [ -d /mingw64 ] && export is_os_mingw64=1
export is_os_android_termux=0 && [ -d /data/data/com.termux ] && export is_os_android_termux=1
export is_os_arch_linux=0 && command grep -Eiq "ID(_LIKE)?=(arch|steamos)" /etc/os-release 2>/dev/null && export is_os_arch_linux=1
export is_os_steamdeck=$is_os_arch_linux
export is_os_redhat=0 && command grep -Eiq "ID(_LIKE)?=(fedora|rhel|centos|rocky|alma)" /etc/os-release 2>/dev/null && export is_os_redhat=1
export is_os_window=0 && { [ -d /mnt/c/Windows ] || [ -d /c/Windows ]; } && export is_os_window=1
export is_os_wsl=0 && command grep -qi "microsoft" /proc/version 2>/dev/null && export is_os_wsl=1
EOF
fi

# Ensure Repo URL is present
if [ -f "$BASH_SYLE_COMMON_PATH" ] && ! grep -q "BASH_PROFILE_CODE_REPO_RAW_URL" "$BASH_SYLE_COMMON_PATH"; then
  echo "export BASH_PROFILE_CODE_REPO_RAW_URL=\"$BASH_PROFILE_CODE_REPO_RAW_URL\"" >> "$BASH_SYLE_COMMON_PATH"
fi
[ -f "$BASH_SYLE_COMMON_PATH" ] && . "$BASH_SYLE_COMMON_PATH"


##########################################################
# Auto-detect mode
##########################################################
# If $0 is run.sh, we're running locally; otherwise piped (e.g. curl | bash)
case "$(basename "$0")" in
  run.sh) _default_mode="local" ;;
  *) _default_mode="prod" ;;
esac

run_mode="$_default_mode"
files_to_test=""
pre_run_scripts=""
run_only_prescripts=false
force_refresh=false
_parsing_into=""
unset TEST_SCRIPT_MODE
unset TEST_SCRIPT_FILES

##########################################################
# Parse arguments
##########################################################
for arg in "$@"; do
  case "$arg" in
    --mode=*|-mode=*)
      run_mode="${arg#*mode=}"
      _parsing_into=""
      ;;
    --files=*|-files=*)
      _val="${arg#*files=}"
      if [ -n "$_val" ]; then
        files_to_test="${files_to_test:+$files_to_test,}$_val"
      fi
      _parsing_into="files"
      ;;
    --pre-scripts=*|-pre-scripts=*)
      _val="${arg#*pre-scripts=}"
      if [ -n "$_val" ]; then
        pre_run_scripts="${pre_run_scripts:+$pre_run_scripts,}$_val"
      fi
      _parsing_into="prescripts"
      ;;
    --prod|-prod)
      run_mode="prod"
      _parsing_into=""
      ;;
    --local|--dev|-local|-dev)
      run_mode="local"
      _parsing_into=""
      ;;
    --run-only-prescripts|-run-only-prescripts)
      run_only_prescripts=true
      _parsing_into=""
      ;;
    --force-refresh|-force-refresh|--force|-force)
      force_refresh=true
      _parsing_into=""
      ;;
    --lightweight|-lightweight)
      export LIGHT_WEIGHT_MODE=1
      _parsing_into=""
      ;;
    -*)
      # ignore unknown flags
      _parsing_into=""
      ;;
    *)
      # Bare args: append to whichever flag was last parsed, default to files
      _target="${_parsing_into:-files}"
      case "$_target" in
        prescripts)
          pre_run_scripts="${pre_run_scripts:+$pre_run_scripts,}$arg"
          ;;
        *)
          files_to_test="${files_to_test:+$files_to_test,}$arg"
          ;;
      esac
      ;;
  esac
done

##########################################################
# Set exports
##########################################################
if [ "$run_mode" = "local" ]; then export TEST_SCRIPT_MODE=1; fi
if [ -n "$files_to_test" ]; then export TEST_SCRIPT_FILES="$files_to_test"; fi

##########################################################
# Print run info
##########################################################
run_description="
  mode              = $run_mode
  files             = ${files_to_test:-[full run]}
  pre_scripts       = ${pre_run_scripts:-[none]}
  run_only_prescripts = $run_only_prescripts
  force_refresh     = $force_refresh
  lightweight       = ${LIGHT_WEIGHT_MODE:-0}
  test_script_mode  = $TEST_SCRIPT_MODE
"

echo "=======================================================
= run.sh started at $(date '+%Y-%m-%d %H:%M:%S')
=$run_description======================================================="

##########################################################
# Helpers
##########################################################

# get_file_contents - outputs the concatenated contents of the given files.
# In prod mode, fetches via curl from upstream. In local mode, reads via cat.
# Supports comma-separated, space-separated, and multiline file lists.
get_file_contents() {
  echo "$1" | tr ',; ' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;/^$/d' | while read -r _file; do
    if [ "$run_mode" = "prod" ]; then
      curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/$_file"
    else
      cat "$_file"
    fi
  done
}

##########################################################
# Run pre-scripts
##########################################################
if [ -n "$pre_run_scripts" ]; then
  echo ">> pre-run scripts: $pre_run_scripts"
  get_file_contents "$pre_run_scripts" | bash
fi

if [ "$run_only_prescripts" = true ]; then
  echo "=======================================================
= run.sh done at $(date '+%Y-%m-%d %H:%M:%S')
======================================================="
  exit 0
fi

##########################################################
# Install NVM and Node (skip on Android Termux)
##########################################################
if [ "$is_os_android_termux" != "1" ]; then
  DEFAULT_NODE_JS_VERSION=24
  NVM_DIR="$HOME/.nvm"

  # Force refresh: remove existing nvm and reinstall
  if [ "$force_refresh" = true ] && [ -d "$NVM_DIR" ]; then
    rm -rf "$NVM_DIR"
  fi

  if [ ! -s $NVM_DIR/nvm.sh ]; then
    git clone --depth 1 -b master https://github.com/creationix/nvm.git $NVM_DIR &>/dev/null
    pushd $NVM_DIR &>/dev/null
    git checkout `git describe --abbrev=0 --tags --match "v[0-9]*" $(git rev-list --tags --max-count=1)` &>/dev/null
    . ./nvm.sh
    popd &>/dev/null

    nvmInstallNode() {
      nvm ls "$1" &>/dev/null || nvm install "$1" &>/dev/null
    }
    nvmInstallNode $DEFAULT_NODE_JS_VERSION

    nvm alias default $DEFAULT_NODE_JS_VERSION &>/dev/null
    nvm use default &>/dev/null

    # Run in background: non-blocking installs
    nvmInstallNode lts &>/dev/null &
    npm install --global yarn prettier &>/dev/null &
  fi
fi

##########################################################
# Run main script
##########################################################
get_file_contents "software/base-node-script.js" | node | bash

echo "=======================================================
= run.sh done at $(date '+%Y-%m-%d %H:%M:%S')
======================================================="

