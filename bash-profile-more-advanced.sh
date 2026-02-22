#! /bin/sh

##########################################################
# Docker Aliases and Functions
##########################################################
dexecBash(){
  echo "docker exec -it $@ /bin/bash";
  docker exec -it $@ /bin/bash
}
alias d='docker'
alias drun='docker run'
alias dexec='dexecBash'
alias apt='sudo apt-get'
alias bat='batcatfull -p --paging=never'

# make sure the bookmark is present
touch ~/.syle_bookmark

##########################################################
# Bat / Cat Setup
##########################################################
batcatfull() {
    # Try the 'bat' command first
    bat "$@" 2>/dev/null
    if [ $? -ne 0 ]; then
        # If 'bat' fails, try the 'batcat' command
        batcat "$@" 2>/dev/null
    fi
}

##########################################################
# Clipboard (pbcopy / pbpaste)
##########################################################
if ! command -v pbcopy &>/dev/null; then
    pbcopy() { xclip -selection clipboard; }
    export -f pbcopy
fi

if ! command -v pbpaste &>/dev/null; then
    pbpaste() { xclip -selection clipboard -o; }
    export -f pbpaste
fi

##########################################################
# File Watcher
##########################################################
# Pass a path to watch, a file filter, and a command to run when those files are updated
# watch.sh "node_modules/everest-*/src/templates" "*.handlebars" "ynpm compile-templates"
# Source: https://gist.github.com/JarredMack/b33900d64c0e448fd5ff1e1bd760789e
watch(){
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

##########################################################
# Network Utilities
##########################################################
listPort(){
  echo "list port $@"
  lsof -i tcp:$@
}

##########################################################
# Git Utilities
##########################################################
gitCompare(){
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

##########################################################
# Editor Launchers
##########################################################
# The Unified Execution Engine and Clean Diagnostic Print Function
run_editor() {
  local editor_name="$1"
  shift
  local paths=("$@")
  local target_binary=""

  # Expand paths with wildcards (case-insensitive)
  shopt -s nullglob nocaseglob
  for binary in "${paths[@]}"; do
    if [[ -x "$binary" ]]; then
      target_binary="$binary"
      break
    fi
  done
  shopt -u nullglob nocaseglob

  # Execution Logic
  if [[ -n "$target_binary" ]]; then
    (nohup "$target_binary" "${editor_args[@]}" >/dev/null 2>&1 &)
  elif [[ "$editor_name" == "code" ]] && command -v flatpak &> /dev/null; then
    target_binary="flatpak:vscodium"
    (nohup flatpak run com.vscodium.codium "${editor_args[@]}" >/dev/null 2>&1 &)
  else
    echo "Error: $editor_name not found in search paths."
    return 1
  fi

  # Combined Print Logic (replaces print_editor_path)
  echo """
====================================
\"$target_binary\" ${editor_args[@]}
PWD:    $(pwd)
Path:   $(realpath .)
====================================
"""
}

subl() {
  local editor_args=("-n" "$@") # "-n" forces a new window/session
  run_editor "sublime" \
    /Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl \
    /mnt/c/Program*Files/Sublime*Text*/sublime*.exe \
    /mnt/c/Program*Files/Sublime*Text*/subl* \
    /opt/sublime_text/subl* \
    /usr/bin/subl \
    /usr/local/bin/subl
}

code() {
  local editor_args=("-n" "$@") # "-n" forces a new window/session
  run_editor "code" \
    /mnt/c/Users/Sy*/AppData/Local/Programs/Microsoft*Code/Code.exe \
    /mnt/c/Users/Le*/AppData/Local/Programs/Microsoft*Code/Code.exe \
    /mnt/c/Program*Files/VSCodium/VSCodium.exe \
    /mnt/c/Program*Files/Microsoft*VS*Code/Code.exe \
    /usr/local/bin/codium \
    /usr/local/bin/code \
    /usr/bin/codium \
    /usr/bin/code
}

codeListExtensions(){
  code --list-extensions
}

##########################################################
# Copy with Progress Bar
##########################################################
cp2(){
  echo "==== copy ===="
  echo "src:" "$1"
  echo "dest:" "$2";
  pv "$1" > "$2"
}

##########################################################
# FZF Advanced Functions
# https://github.com/junegunn/fzf/wiki/examples
##########################################################
alias gco='fuzzyGitCobranch'
alias gbranch='gco'
alias gbr='gco'
alias glog='fuzzyGitShow'
alias gl='glog'
alias gp='git push'

# override viewfile with more advanced function
viewFile(){
  local editorCmd

  if [[ $# -eq 0 ]] ; then
    return 1 # silent exit
  fi

  editorCmd=subl
  echo "$editorCmd $1"
  $editorCmd "$1"
}

fuzzyGitShow(){
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset' --abbrev-commit --date=relative --color=always \
  |
  fzf --ansi --no-sort --reverse --tiebreak=index --bind=ctrl-s:toggle-sort --color light --preview='echo {} | cut -d " " -f1 | xargs git show' \
  --bind "ctrl-m:execute:
  (grep -o '[a-f0-9]\{7\}' | head -1 |
  xargs -I % sh -c 'git show --color=always % | less -R') << 'FZF-EOF'
  {}
  FZF-EOF"
}

fuzzyGitCobranch(){
  local branches branch
  branches=$(git branch --all | grep -v HEAD | sed 's/remotes\/origin\///g' | sed "s/.* //" | sed 's/ //g' | sed "s#remotes/[^/]*/##" | sort | uniq) &&
  branch=$(echo "$branches" |
  fzf-tmux -d $(( 2 + $(wc -l <<< "$branches") )) +m) &&
  git checkout $(echo "$branch")
}

# different completion trigger
export FZF_COMPLETION_TRIGGER='*'

##########################################################
# Prompt Helpers
##########################################################
parseGitBranch(){
node -e """
  const { exec } = require('child_process');
  exec('git branch | grep \"*\"', (error, stdout, stderr) => !error && console.log('['+stdout.replace('*','').trim()+']'));
"""
}

ifconfig2(){
node -e """
  const { networkInterfaces } = require('os');
  const nets = Object.values(networkInterfaces());
  console.log([... new Set(JSON.stringify(nets, null, 1).split('\n').filter(line => line.includes('.') && line.includes('address') && line.includes('127.0.0.1') === false).map(line => line.substr(14).replace(/[\",]/g,'')))].join(', '))
"""
}

shorterPwdPath(){
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

##########################################################
# Prompt
##########################################################
export PS1="
\[\e[31m\]====\[\e[m\]
\[\e[33m\]\T\[\e[m\] \[\e[36m\]\u\[\e[m\] @ \[\e[32m\]\h\[\e[m\] - \`ifconfig2\`
\[\e[33m\]\`shorterPwdPath\`\[\e[m\] \[\e[31m\]\`parseGitBranch\`\[\e[m\]
\[\e[33m\]>\[\e[m\]\[\e[31m\]>\[\e[m\]\[\e[36m\]>\[\e[m\] "
