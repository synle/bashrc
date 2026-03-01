#!/usr/bin/env bash
{
################################################################################
# ---- run.sh - Unified test runner script ----
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
#   bash run.sh --force-refresh                    # Force remove and reinstall fnm
#   bash run.sh -f                                 # Shorthand for --force-refresh
#   bash run.sh --lightweight                      # Export IS_LIGHT_WEIGHT_MODE=1 for lightweight installs
#   bash run.sh --debug                            # Enable debug mode (keep temp scripts for inspection)
#   bash run.sh -D                                 # Shorthand for --debug
#   bash run.sh --verbose                          # Enable verbose mode (set -x for bash tracing)
#   bash run.sh -V                                 # Shorthand for --verbose
#
# Single dash also works: -prod, -local, -dev, -mode=..., -files=..., -force-refresh, -f, -lightweight, -debug, -D, -verbose, -V
################################################################################

################################################################################
# ---- Prerequisites - OS Flags & Helpers ----
################################################################################

# BEGIN bootstrap/common-env.sh

# END bootstrap/common-env.sh

################################################################################
# ---- Auto-detect mode ----
################################################################################
# If $0 is run.sh, we're running locally; otherwise piped (e.g. curl | bash)
case "$(basename "$0")" in
  run.sh) _default_mode="local" ;;
  *) _default_mode="prod" ;;
esac

run_mode="$_default_mode"
files_to_test=""
force_refresh=false
debug_mode=false
verbose_mode=false
_parsing_into=""
unset IS_TEST_SCRIPT_MODE
unset TEST_SCRIPT_FILES
unset IS_FORCE_REFRESH

################################################################################
# ---- Parse arguments ----
################################################################################
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
    --prod|-prod)
      run_mode="prod"
      _parsing_into=""
      ;;
    --local|--dev|-local|-dev)
      run_mode="local"
      _parsing_into=""
      ;;
    --force-refresh|-force-refresh|--force|-force|-f)
      force_refresh=true
      export IS_FORCE_REFRESH=1
      _parsing_into=""
      ;;
    --lightweight|-lightweight)
      export IS_LIGHT_WEIGHT_MODE=1
      _parsing_into=""
      ;;
    --verbose|-verbose|-V)
      verbose_mode=true
      set -x
      _parsing_into=""
      ;;
    --debug|-debug|-D)
      debug_mode=true
      export IS_DEBUG=1
      _parsing_into=""
      ;;
    -*)
      # ignore unknown flags
      _parsing_into=""
      ;;
    *)
      # Bare args: append to files
      files_to_test="${files_to_test:+$files_to_test,}$arg"
      ;;
  esac
done

################################################################################
# ---- Set exports ----
################################################################################
if [ "$run_mode" = "local" ]; then export IS_TEST_SCRIPT_MODE=1; fi
if [ -n "$files_to_test" ]; then export TEST_SCRIPT_FILES="$files_to_test"; fi

################################################################################
# ---- Print run info ----
################################################################################
# Get a comma-separated list of all active is_os_ flags
active_os_flags=$(set | grep -E "^is_os_.*=1" | awk -F= '{print $1}' | paste -sd "," -)

run_description="
mode                = $run_mode
files               = ${files_to_test:-[full run]}
force_refresh       = $force_refresh
debug               = $debug_mode
verbose             = $verbose_mode
lightweight         = ${IS_LIGHT_WEIGHT_MODE:-0}
test_script_mode    = $IS_TEST_SCRIPT_MODE
os_flags            = ${active_os_flags:-[none]}
"

echo "
$LINE_BREAK_HASH
>> run.sh $@  started at $(date '+%Y-%m-%d %H:%M:%S')
$run_description
$LINE_BREAK_HASH
"

_needs_sudo=false
case "$files_to_test" in *bootstrap/dependencies*) _needs_sudo=true ;; esac

if [ "$_needs_sudo" = true ]; then
  sudo echo '> Initializing Environment [with sudo]'
else
  echo '> Initializing Environment'
fi


install_fnm_node

################################################################################
# ---- script: Run (single pipeline for files) ----
################################################################################

echo """
$LINE_BREAK_HASH
>> files: ${files_to_test:-[full run]}
"""

if command -v node >/dev/null 2>&1; then
  run_files
else
  echo "[Skip] Node is not installed — skipping main script."
fi

echo "

$LINE_BREAK_HASH
>> run.sh $@ done at $(date '+%Y-%m-%d %H:%M:%S')
$LINE_BREAK_HASH
"

# Final touch: make current user owner of ~/.local (only if ownership differs)
if [ -d "${HOME}/.local" ] && [ "$(stat -c '%u' "${HOME}/.local" 2>/dev/null || stat -f '%u' "${HOME}/.local" 2>/dev/null)" != "$(id -u)" ]; then
  sudo chown -R "$(whoami)" "${HOME}/.local" 2>/dev/null
fi

# Source .bash_syle
echo '''
# source the new profile here
[ -f "${HOME}/.bash_syle" ] && . "${HOME}/.bash_syle"
'''

exit
}
