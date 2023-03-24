#! /bin/sh
##########################################################
# aliases & functions
##########################################################
# docker
dexecBash(){
  echo "docker exec -it $@ /bin/bash";
  docker exec -it $@ /bin/bash
}
alias d='docker'
alias drun='docker run'
alias dexec='dexecBash'

# other things
alias ls="exa"
alias ll="exa -la"

# zoxide setup
eval "$(zoxide init bash)"
alias cd='z'

# bat / cat setup
alias cat='bat -p --paging=never'

# fd
alias find2='fd'

# entr setup
# ls *.js | entr node main.js

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

listPort(){
  echo "list port $@"
  lsof -i tcp:$@
}

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

subl(){
  if [ $is_os_wsl == "1" ]
  then
    # for windows
    # getting the path
    sublime_text.exe "$@" > /dev/null 2>&1 &

    echo """
Full Path: $(realpath "$@")
 WSL Path: $(findResolvedPathForWsl1 "$@")
    """
  elif  [ $is_os_darwin_mac == "1" ]
  then
    # for osx darwin
    sublime_osx_darwin_binary_path="/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl";
    $sublime_osx_darwin_binary_path "$@" &> /dev/null 2>&1

    echo """
Full Path: $(echo "$@")
    """
  fi

  echo "subl \"$@\""
}

code()
{
  if [ $is_os_wsl == "1" ]
  then
    # for windows
    # vs_code_win32_binary_path="/mnt/c/Program Files/Microsoft VS Code/Code.exe"
    # { echo "\"$vs_code_win32_binary_path\" \"$(findResolvedPathForWsl1 "$@")\""; } | bash

    Code.exe "$@" > /dev/null 2>&1 &

    echo """
Full Path: $(realpath "$@")
 WSL Path: $(findResolvedPathForWsl1 "$@")
    """
  elif  [ $is_os_darwin_mac == "1" ]
  then
    # for osx darwin
    vs_code_osx_darwin_binary_path="/usr/local/bin/code";
    "$vs_code_osx_darwin_binary_path" "$@" &> /dev/null 2>&1

    echo """
Full Path: $(echo "$@")
    """
  fi

  echo "code \"$@\""
}

codeListExtensions(){
  if [ $is_os_wsl == "1" ]
  then
    # for windows
    cmd.exe /c "code --list-extensions"
  elif  [ $is_os_darwin_mac == "1" ]
  then
    code --list-extensions
  fi
}

codeInstallExtension(){
  if [ $is_os_wsl == "1" ]
  then
    # for windows
    cmd.exe /c "code --install-extension $1"
  elif  [ $is_os_darwin_mac == "1" ]
  then
    code --install-extension "$1"
  fi
}

# copy command with progress bar
cp2(){
  echo "==== copy ===="
  echo "src:" "$1"
  echo "dest:" "$2";
  pv "$1" > "$2"
}

##########################################################
#############  SECTION BREAK
##########################################################


##########################################################
# fzf - more advanced functions
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

    if isCommandExists subl.exe ; then
      # wsl mode
      editorCmd=subl.exe
    elif isCommandExists subl ; then
      # mac or other linux
      editorCmd=subl
    else
      # no subl, fall back to vim
      editorCmd=vim;
    fi

    echo "$editorCmd $1"
    $editorCmd "$1"
}


#fuzzy git
fuzzyGitShow(){
  # git log --pretty=format:'%Cred%h%Creset %s %Cgreen%cr %C(bold blue)%an%Creset' --abbrev-commit --date=relative --color=always \
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
#############  SECTION BREAK
##########################################################


##########################################################
####################  Prompt  ##############
##########################################################
# get current branch in git repo
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

# short path
# node version
shorterPwdPath(){
node -e """
  const splits = process.cwd().split('/'); console.log(splits.map((s,idx) => idx !== splits.length - 1 ? s[0] : s).join('/'));
"""
}


#bash prompt
export PS1="
\[\e[31m\]====\[\e[m\]
\[\e[33m\]\T\[\e[m\] \[\e[36m\]\u\[\e[m\] @ \[\e[32m\]\h\[\e[m\] - \`ifconfig2\`
\[\e[33m\]\`shorterPwdPath\`\[\e[m\] \[\e[31m\]\`parseGitBranch\`\[\e[m\]
\[\e[33m\]>\[\e[m\]\[\e[31m\]>\[\e[m\]\[\e[36m\]>\[\e[m\] "
