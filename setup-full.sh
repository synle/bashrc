#! /bin/sh
sudo echo 'This script requires sudo...'

# NOTE - IMPORTANT: This is where you update the bash profile code repo raw url
export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/synle/bashrc/master"

run_mode="${RUN_MODE:-prod}"

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --mode=*|-mode=*)
      run_mode="${arg#*mode=}"
      ;;
    --prod|-prod)
      run_mode="prod"
      ;;
    --local|--dev|-local|-dev)
      run_mode="local"
      ;;
  esac
done

# get_file_contents - outputs the concatenated contents of the given files.
# In prod mode, fetches via curl from upstream. In local mode, reads via cat.
# Usage: get_file_contents "file1.sh,file2.sh"
get_file_contents() {
  _files="$1"
  for _file in $(echo "$_files" | tr ',; ' '\n'); do
    if [ "$run_mode" = "prod" ]; then
      curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/$_file"
    else
      cat "$_file"
    fi
  done
}

# run pre-scripts then full test suite via run.sh
get_file_contents "run.sh" | bash -s -- --mode="$run_mode" --pre-scripts="bash-profile-barebone.sh,bash-first-and-only-one-time.sh,setup-dependencies.sh"
