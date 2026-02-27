#!/usr/bin/env bash
{
####################################################################
# run.sh - Unified test runner script
#
# Usage:
#   bash run.sh                                    # Full run, local mode (default)
#   bash run.sh --mode=prod                        # Full run, prod mode (curl from upstream)
#   bash run.sh --prod                             # Shorthand for --mode=prod
#   bash run.sh --local                            # Shorthand for --mode=local
#   bash run.sh --dev                              # Shorthand for --mode=local
#   bash run.sh --files="git.js"                   # Test specific file(s), local mode
#   bash run.sh --mode=prod --files="git.js"       # Test specific file(s), prod mode
#   bash run.sh --files="vim.js,git.js"            # Multiple files (comma-separated)
#   bash run.sh --files="""                        # Multiple files (multiline)
#     vim.js
#     git.js
#     vundle.js
#   """
#   bash run.sh git.js                             # Bare args treated as files
#   bash run.sh git.js vim.js                      # Multiple bare args
#   bash run.sh --prod git.js vim.js               # Mix flags and bare file args
#   bash run.sh --pre-scripts="foo.sh,bar.sh"      # Run shell scripts via | bash before main run
#   bash run.sh --pre-scripts="""                  # Multiline pre-scripts
#     foo.sh
#     bar.sh
#   """
#   bash run.sh --run-only-prescripts              # Only run pre-scripts, skip main run
#   bash run.sh --force-refresh                    # Force remove and reinstall fnm
#   bash run.sh -f                                 # Shorthand for --force-refresh
#   bash run.sh --lightweight                      # Export LIGHT_WEIGHT_MODE=1 for lightweight installs
#   bash run.sh --debug                            # Enable debug mode (set -x for verbose output)
#   bash run.sh -D                                 # Shorthand for --debug
#
# Single dash also works: -prod, -local, -dev, -mode=..., -files=..., -pre-scripts=..., -run-only-prescripts, -force-refresh, -f, -lightweight, -debug, -D
####################################################################

####################################################################
# Prerequisites - OS Flags & Helpers
####################################################################

# BEGIN bootstrap/common-env.sh

# END bootstrap/common-env.sh

####################################################################
# Auto-detect mode
####################################################################
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
debug_mode=false
_parsing_into=""
unset TEST_SCRIPT_MODE
unset TEST_SCRIPT_FILES
unset TEST_FORCE_REFRESH

####################################################################
# Parse arguments
####################################################################
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
    --force-refresh|-force-refresh|--force|-force|-f)
      force_refresh=true
      export TEST_FORCE_REFRESH=1
      _parsing_into=""
      ;;
    --lightweight|-lightweight)
      export LIGHT_WEIGHT_MODE=1
      _parsing_into=""
      ;;
    --debug|-debug|-D)
      debug_mode=true
      set -x
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

####################################################################
# Set exports
####################################################################
if [ "$run_mode" = "local" ]; then export TEST_SCRIPT_MODE=1; fi
if [ -n "$files_to_test" ]; then export TEST_SCRIPT_FILES="$files_to_test"; fi

####################################################################
# Print run info
####################################################################
# Get a comma-separated list of all active is_os_ flags
active_os_flags=$(set | grep -E "^is_os_.*=1" | awk -F= '{print $1}' | paste -sd "," -)

run_description="
mode                = $run_mode
files               = ${files_to_test:-[full run]}
pre_scripts         = ${pre_run_scripts:-[none]}
run_only_prescripts = $run_only_prescripts
force_refresh       = $force_refresh
debug               = $debug_mode
lightweight         = ${LIGHT_WEIGHT_MODE:-0}
test_script_mode    = $TEST_SCRIPT_MODE
os_flags            = ${active_os_flags:-[none]}
"

echo "
=======================================================
>> run.sh started at $(date '+%Y-%m-%d %H:%M:%S')
$run_description
=======================================================
"

####################################################################
# Helpers
####################################################################
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

_needs_sudo=false
case "$pre_run_scripts" in *bootstrap/dependencies*) _needs_sudo=true ;; esac
case "$files_to_test" in *bootstrap/dependencies*) _needs_sudo=true ;; esac

if [ "$_needs_sudo" = true ]; then
  sudo echo '> Initializing Environment [with sudo]'
else
  echo '> Initializing Environment'
fi


####################################################################
# script: Install fnm and Node (skip on Android Termux)
####################################################################
# Force refresh: remove existing fnm node and reinstall
if [ "$TEST_FORCE_REFRESH" = true ] && command -v fnm >/dev/null 2>&1; then
  fnm uninstall "$NODE_JS_VERSION" >/dev/null 2>&1
fi
if [ "$is_os_android_termux" != "1" ]; then
  echo ">> Installing fnm (for nodejs)"
  if ! command -v fnm >/dev/null 2>&1; then
    echo "  >> Downloading fnm"
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell >/dev/null 2>&1
  fi

  # Source fnm
  export PATH="$FNM_DIR:$PATH"
  eval "$(fnm env)"

  # Install Node if missing
  if ! fnm ls "$NODE_JS_VERSION" >/dev/null 2>&1; then
    fnm install "$NODE_JS_VERSION" >/dev/null 2>&1
  else
    echo "Node $NODE_JS_VERSION already installed — skip"
  fi

  # Set + use default quietly
  fnm default "$NODE_JS_VERSION" >/dev/null 2>&1
  fnm use "$NODE_JS_VERSION" >/dev/null 2>&1

  # Export resolved node path for downstream scripts
  export FNM_DEFAULT_NODE_PATH="$FNM_DIR/node-versions/$(node -v 2>/dev/null)/installation"
fi

####################################################################
# script: Run pre-scripts
####################################################################
if [ -n "$pre_run_scripts" ]; then
  echo ">> pre-run scripts: $pre_run_scripts"
  $(get_file_contents "$pre_run_scripts")
fi

####################################################################
# script: Run main script - if needed
####################################################################
if [ "$run_only_prescripts" != true ]; then
  if command -v node >/dev/null 2>&1; then
    get_file_contents "software/index.js" | node | bash
  else
    echo "[Skip files] Node is not installed — skipping main script."
  fi
fi

echo "

=======================================================
>> run.sh done at $(date '+%Y-%m-%d %H:%M:%S')
=======================================================
"

# Final touch: make current user owner of ~/.local
[ -d "${HOME}/.local" ] && sudo chown -R "$(whoami)" "${HOME}/.local" 2>/dev/null

# Source .bash_syle
echo '''
# source the new profile here
[ -f "${HOME}/.bash_syle" ] && . "${HOME}/.bash_syle"
'''

exit
}
