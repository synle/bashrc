# opencode: wrapper around the `opencode` binary
# SOURCE | software/bootstrap/common-functions.bash
function opencode() {
  if ! command -v opencode > /dev/null 2>&1; then
    echo "opencode is not installed" >&2
    return 1
  fi
  command opencode "$@"
}

alias op='opencode'
