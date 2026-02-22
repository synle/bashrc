#! /bin/sh

# Unified test runner script
#
# Usage:
#   sh run.sh                                    # Full run, local mode (default)
#   sh run.sh --mode=prod                        # Full run, prod mode (curl from upstream)
#   sh run.sh --prod                             # Shorthand for --mode=prod
#   sh run.sh --local                            # Shorthand for --mode=local
#   sh run.sh --dev                              # Shorthand for --mode=local
#   sh run.sh --files="git.js"                   # Test specific file(s), local mode
#   sh run.sh --mode=prod --files="git.js"       # Test specific file(s), prod mode
#   sh run.sh --files="vim.js,git.js"            # Multiple files
#   sh run.sh --files="""
#     vim.js
#     git.js
#     vundle.js
#   """
#   sh run.sh git.js                             # Bare args treated as files
#   sh run.sh git.js vim.js                      # Multiple bare args joined with comma
#   sh run.sh --prod git.js vim.js               # Mix flags and bare file args
#
# Single dash also works: -prod, -local, -dev, -mode=..., -files=...

run_mode="${RUN_MODE:-local}"
files_to_test="${TEST_SCRIPT_FILES:-}"
bare_files=""

# Parse arguments (override env vars)
for arg in "$@"; do
  case "$arg" in
    --mode=*|-mode=*)
      run_mode="${arg#*mode=}"
      ;;
    --files=*|-files=*)
      files_to_test="${arg#*files=}"
      ;;
    --prod|-prod)
      run_mode="prod"
      ;;
    --local|--dev|-local|-dev)
      run_mode="local"
      ;;
    -*)
      # ignore unknown flags
      ;;
    *)
      # bare args are treated as file names
      if [ -n "$bare_files" ]; then
        bare_files="$bare_files,$arg"
      else
        bare_files="$arg"
      fi
      ;;
  esac
done

# Bare file args apply only if --files was not explicitly set
if [ -n "$bare_files" ] && [ -z "$files_to_test" ]; then
  files_to_test="$bare_files"
fi

if [ "$run_mode" = "local" ]; then
  export TEST_SCRIPT_MODE=1
else
  export TEST_SCRIPT_MODE=0
fi

if [ -n "$files_to_test" ]; then
  export TEST_SCRIPT_FILES="$files_to_test"
  echo "< run.sh (mode=$run_mode, files=$TEST_SCRIPT_FILES)"
else
  unset TEST_SCRIPT_FILES
  echo "< run.sh (mode=$run_mode, full run)"
fi

if [ "$run_mode" = "prod" ]; then
  { \
    curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/base-node-script.js ;
  } | node | bash
else
  { \
    cat software/base-node-script.js ;
  } | node | bash
fi
