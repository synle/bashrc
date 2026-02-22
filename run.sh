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
#   sh run.sh --pre-scripts="foo.sh,bar.sh"      # Run shell scripts via | bash before main run
#
# Single dash also works: -prod, -local, -dev, -mode=..., -files=..., -pre-scripts=...

# NOTE - IMPORTANT: This is where you update the bash profile code repo raw url
export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/synle/bashrc/master"

run_mode="${RUN_MODE:-local}"
files_to_test="${TEST_SCRIPT_FILES:-}"
pre_run_scripts="${PRE_RUN_SCRIPTS:-}"
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
    --pre-scripts=*|-pre-scripts=*)
      pre_run_scripts="${arg#*pre-scripts=}"
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
  echo "< run.sh (mode=$run_mode) (files=$TEST_SCRIPT_FILES) (pre_scripts=$pre_run_scripts)"
else
  unset TEST_SCRIPT_FILES
  echo "< run.sh (mode=$run_mode) (files==[full run]) (pre_scripts=$pre_run_scripts)"
fi

if [ "$run_mode" = "prod" ]; then
  # run pre-run shell scripts via | bash before the main run
  if [ -n "$pre_run_scripts" ]; then
    echo ">> pre-run scripts: $pre_run_scripts"
    { \
      for script in $(echo "$pre_run_scripts" | tr ',; ' '\n'); do \
        curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/$script" ; \
      done ; \
    } | bash
  fi

  { \
    curl -s $BASH_PROFILE_CODE_REPO_RAW_URL/software/base-node-script.js ;
  } | node | bash
else
  # run pre-run shell scripts via | bash before the main run
  if [ -n "$pre_run_scripts" ]; then
    echo ">> pre-run scripts: $pre_run_scripts"
    { \
      for script in $(echo "$pre_run_scripts" | tr ',; ' '\n'); do \
        cat "$script" ; \
      done ; \
    } | bash
  fi

  { \
    cat software/base-node-script.js ;
  } | node | bash
fi
