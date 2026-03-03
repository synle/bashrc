# software/bootstrap/profile-advanced.sh

################################################################################
# ---- Docker Aliases and Functions ----
################################################################################
function dexec_bash() {
  echo "docker exec -it $@ /bin/bash";
  docker exec -it $@ /bin/bash
}
alias d='docker'
alias drun='docker run'
alias dexec='dexec_bash'
alias apt='sudo apt-get'
alias bat='batcat_full -p --paging=never'

# make sure the bookmark is present
touch ~/.syle_bookmark

################################################################################
# ---- Bat / Cat Setup ----
################################################################################
function batcat_full() {
    # Try the 'bat' command first
    bat "$@" 2>/dev/null
    if [ $? -ne 0 ]; then
        # If 'bat' fails, try the 'batcat' command
        batcat "$@" 2>/dev/null
    fi
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
################################################################################
# Pass a path to watch, a file filter, and a command to run when those files are updated
# watch.sh "node_modules/everest-*/src/templates" "*.handlebars" "ynpm compile-templates"
# Source: https://gist.github.com/JarredMack/b33900d64c0e448fd5ff1e1bd760789e
function watch() {
  WORKING_PATH=$(pwd)
  DIR=$1
  FILTER=$2
  COMMAND=$3
  chsum1=""

  while [[ true ]]
  do
    chsum2=$(find -L $WORKING_PATH/$DIR -type f -name "$FILTER" -exec md5 {} \;)
    if [[ $chsum1 != $chsum2 ]] ; then
      echo "Found a file change, executing $COMMAND..."
      $COMMAND
      chsum1=$chsum2
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
# ---- Git Utilities ----
################################################################################
function git_compare() {
  #get current branch name
  branch_name=$(git symbolic-ref -q HEAD)
  branch_name=${branch_name##refs/heads/}
  branch_name=${branch_name:-HEAD}

  #get current project name
  project_name=$(git rev-parse --show-toplevel);
  project_name=${project_name##*/}

  #get current repo name
  repo_name=$(git config --get remote.origin.url)
  repo_name=${repo_name#*:}
  repo_name=${repo_name/.git/}

  baseSha1=${2-staging}
  baseSha2=${1-$branch_name}

  urlToShow=https://github.com/${repo_name}/compare/${baseSha1}...${baseSha2}
  echo $urlToShow

  if hash open 2>/dev/null; then
    open $urlToShow
  fi
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
# https://github.com/junegunn/fzf/wiki/examples
################################################################################
alias gco='fuzzy_git_cobranch'
alias gbranch='gco'
alias gbr='gco'
alias glog='fuzzy_git_show'
alias gl='glog'
alias gp='git push'

# override viewfile with more advanced function
function view_file() {
  local editorCmd

  if [[ $# -eq 0 ]] ; then
    return 1 # silent exit
  fi

  editorCmd=subl
  echo "$editorCmd $1"
  $editorCmd "$1"
}

function fuzzy_git_show() {
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset' --abbrev-commit --date=relative --color=always \
  |
  fzf --ansi --no-sort --reverse --tiebreak=index --bind=ctrl-s:toggle-sort --color light --preview='echo {} | cut -d " " -f1 | xargs git show' \
  --bind "ctrl-m:execute:
  (grep -o '[a-f0-9]\{7\}' | head -1 |
  xargs -I % sh -c 'git show --color=always % | less -R') << 'FZF-EOF'
  {}
  FZF-EOF"
}

function fuzzy_git_cobranch() {
  local branches branch
  branches=$(git branch --all | grep -v HEAD | sed 's/remotes\/origin\///g' | sed "s/.* //" | sed 's/ //g' | sed "s#remotes/[^/]*/##" | sort | uniq) &&
  branch=$(echo "$branches" |
  fzf-tmux -d $(( 2 + $(wc -l <<< "$branches") )) +m --layout=reverse) &&
  git checkout $(echo "$branch")
}

# different completion trigger
export FZF_COMPLETION_TRIGGER='*'

################################################################################
# ---- Prompt Helpers ----
################################################################################
function parse_git_branch() {
node -e """
  const { exec } = require('child_process');
  exec('git branch | grep \"*\"', (error, stdout, stderr) => !error && console.log('['+stdout.replace('*','').trim()+']'));
"""
}

function ifconfig2() {
node -e """
  const { networkInterfaces } = require('os');
  const nets = Object.values(networkInterfaces());
  console.log([... new Set(JSON.stringify(nets, null, 1).split('\n').filter(line => line.includes('.') && line.includes('address') && line.includes('127.0.0.1') === false).map(line => line.substr(14).replace(/[\",]/g,'')))].join(', '))
"""
}

function shorter_pwd_path() {
  local trim_count=3  # Set the number of parts to retain in the path
  IFS='/' read -r -a splits <<< "$(pwd)"
  result=""

  for idx in "${!splits[@]}"; do
    if [ $idx -lt $((${#splits[@]} - $trim_count)) ]; then
      result+="${splits[$idx]:0:1}/"
    else
      result+="${splits[$idx]}/"
    fi
  done

  # Remove the trailing slash at the end
  echo "${result%/}"
}

# default bookmarks
add_bookmark search_file
add_bookmark search_file_with_git
add_bookmark search_dir_with_git
add_bookmark search_dir

################################################################################
# ---- Refresh script ----
################################################################################
alias refresh="curl -s $BASH_PROFILE_CODE_REPO_RAW_URL/run.sh | bash -s -- --prod --setup"

################################################################################
# ---- Prompt ----
# Add this if we need cool break
# "\$(br 5 no-clear reverse | sed 's/\(\x1b\[[0-9;]*m\)/\x01\1\x02/g')"
################################################################################
# 08:32:43PM U=04:32:43AM syle @ Sy-Omen45L 10.255.255.254, 172.28.2.202
# /h/syle/git/bashrc [master]
# >>>
export PS1_Advanced="\n\
\[\e[1;92m\]\$(get_time) \
\[\e[1;93m\]U=\$(get_time \"UTC\") \
\[\e[1;94m\]\u\[\e[m\] @ \
\[\e[1;95m\]\h \
\[\e[1;93m\]\$(ifconfig2)\[\e[m\]\n\
\[\e[1;31m\]\$(shorter_pwd_path)\[\e[m\] \
\[\e[1;36m\]\$(parse_git_branch)\[\e[m\]\n\
>>> "
export PS1="$PS1_Advanced"

# on WSL, cd to last visited directory on shell start
if [ "$is_os_windows" = "1" ]; then
  golast
fi
