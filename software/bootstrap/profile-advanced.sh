# software/bootstrap/profile-advanced.sh

################################################################################
# ---- Aliases: Docker ----
################################################################################
alias d='docker'
alias drun='docker run'
alias dexec='dexec_bash'
alias apt='sudo apt-get'

# ---- Aliases: Cat (bat/batcat wrapper) ----
alias cat='batcat'

# ---- Aliases: Git (fzf) ----
alias glog='fuzzy_git_show'

################################################################################
# ---- Bat / Cat Setup ----
# uses bat (mac/homebrew) or batcat (debian/ubuntu), falls back to cat
################################################################################
function batcat() {
  # type -P only searches for actual binaries in $PATH, ignoring aliases and functions.
  if type -P bat &>/dev/null; then
      command bat --paging=never "$@"
  elif type -P batcat &>/dev/null; then
      command batcat --paging=never "$@"
  else
      cat "$@"
  fi
}

################################################################################
# ---- Docker ----
################################################################################
function dexec_bash() {
  echo "docker exec -it $@ /bin/bash";
  docker exec -it $@ /bin/bash
}

################################################################################
# ---- Open (cross-platform) ----
################################################################################
function open() {
  echo "open $@ | $(pwd)"
  if [ "$is_os_mac" = "1" ]; then
    command open "$@"
  elif command -v explorer.exe &>/dev/null; then
    explorer.exe "$@"
  elif command -v dolphin &>/dev/null; then
    dolphin "$@" 1>&- 2>&- &
  elif command -v thunar &>/dev/null; then
    thunar "$@" 1>&- 2>&- &
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$@" 1>&- 2>&- &
  else
    echo "No file manager found"
  fi
}
export -f open

################################################################################
# ---- Clipboard (pbcopy / pbpaste) ----
# on mac these are native; on linux use xclip or a file fallback
################################################################################
if [ "$is_os_mac" != "1" ]; then
  if command -v xclip &>/dev/null; then
    function pbcopy() { xclip -selection clipboard; }
    function pbpaste() { xclip -selection clipboard -o; }
  else
    CLIPBOARD_PATH=~/.syle_clipboard
    function pbcopy() { cat > $CLIPBOARD_PATH; }
    function pbpaste() { cat $CLIPBOARD_PATH; }
  fi
  export -f pbcopy
  export -f pbpaste
fi

################################################################################
# ---- File Watcher ----
# Usage: watch <dir> <filter> <command>
# Example: watch src '*.js' 'npm test'
################################################################################
function watch() {
  local dir="${1:-.}"
  local filter="${2:-*}"
  local cmd="$3"
  local chsum1="" chsum2=""

  if [ -z "$cmd" ]; then
    echo "Usage: watch <dir> <filter> <command>"
    echo "Example: watch src '*.js' 'npm test'"
    return 1
  fi

  # use md5sum on linux, md5 on mac
  local md5cmd="md5sum"
  type -P md5sum &>/dev/null || md5cmd="md5"

  while true; do
    chsum2=$(find -L "$dir" -type f -name "$filter" -exec $md5cmd {} \; 2>/dev/null)
    if [ "$chsum1" != "$chsum2" ]; then
      [ -n "$chsum1" ] && echo "File change detected, running: $cmd"
      eval "$cmd"
      chsum1="$chsum2"
    fi
    sleep 2
  done
}

################################################################################
# ---- Network Utilities ----
################################################################################
function list_port() {
  echo "list port $@"
  lsof -i tcp:$@
}

################################################################################
# ---- Copy with Progress Bar ----
################################################################################
function cp2() {
  echo "==== copy ===="
  echo "src:" "$1"
  echo "dest:" "$2";
  pv "$1" > "$2"
}

################################################################################
# ---- FZF Advanced Functions ----
################################################################################
# override view_file with editor
function view_file() {
  local editorCmd

  if [[ $# -eq 0 ]] ; then
    return 1 # silent exit
  fi

  editorCmd=subl
  echo "$editorCmd $1"
  $editorCmd "$1"
}

# interactive git log browser with commit preview
function fuzzy_git_show() {
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always |
  fzf --ansi --no-sort --reverse --tiebreak=index \
    --preview-window=right:60% \
    --preview='hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | head -1);
      git log --color=always --format="%C(yellow)%H%n%C(cyan)Author: %an <%ae>%n%C(green)Date:   %ad%n%n%C(bold white)%s%C(reset)%n%n%b" -1 $hash;
      echo "────────────────────────────────────────────────────";
      git diff-tree --no-commit-id --stat --color=always $hash;
      echo "";
      git diff-tree --no-commit-id -p --color=always $hash' \
    --bind "ctrl-m:execute:(echo {} | grep -o '[a-f0-9]\{7\}' | head -1 | xargs -I % sh -c 'git show --color=always % | less -R')"
}

export FZF_COMPLETION_TRIGGER='*'

################################################################################
# ---- Bookmarks ----
################################################################################
touch ~/.syle_bookmark
add_bookmark fuzzy_open

################################################################################
# ---- Refresh Script ----
################################################################################
alias refresh="curl -s $BASH_PROFILE_CODE_REPO_RAW_URL/run.sh | bash -s -- --prod --setup"

################################################################################
# ---- WSL: Restore Last Directory ----
################################################################################
if [ "$is_os_windows" = "1" ]; then
  golast
fi
