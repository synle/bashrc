#! /bin/sh
##########################################################
# aliases & functions
##########################################################
# docker
dexec_bash(){
  echo "docker exec -it $@ /bin/bash";
  docker exec -it $@ /bin/bash
}
alias d='docker'
alias drun='docker run'
alias dexec='dexec_bash'


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

subl()
{
  if [ $is_os_wsl == "1" ]
  then
    # for windows
    sublime_win32_binary_path="/mnt/c/Program Files/Sublime Text 3/subl.exe";
    "$sublime_win32_binary_path" $(findResolvedPathForWsl1 "$@") &> /dev/null 2>&1;

    echo """
Full Path: $(realpath "$@")
 WSL Path: $(findResolvedPathForWsl1 "$@")
    """
  elif  [ $is_os_darwin_mac == "1" ]
  then
    # for osx darwin
    sublime_osx_darwin_binary_path="/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl";
    $sublime_osx_darwin_binary_path $@ &> /dev/null 2>&1

    echo """
Full Path: $(realpath "$@")
    """
  else
    # for rhel
    sublime_rhel_binary_path="/opt/sublime_text/sublime_text";
    $sublime_rhel_binary_path $@ &> /dev/null 2>&1;

    echo """
Full Path: $(realpath "$@")
    """
  fi
}

code()
{
  if [ $is_os_wsl == "1" ]
  then
    # for windows
    vs_code_win32_binary_path="/mnt/c/Program Files/Microsoft VS Code/Code.exe"
    "$vs_code_win32_binary_path" $(findResolvedPathForWsl1 "$@") > /dev/null 2>&1 &

    echo """
Full Path: $(realpath "$@")
 WSL Path: $(findResolvedPathForWsl1 "$@")
    """
  elif  [ $is_os_darwin_mac == "1" ]
  then
    # for osx darwin
    vs_code_osx_darwin_binary_path="/usr/local/bin/code";
    "$vs_code_osx_darwin_binary_path" $@ &> /dev/null 2>&1

    echo """
Full Path: $(realpath "$@")
    """
  else
    # for rhel
    vs_code_rhel_binary_path="/opt/sublime_text/sublime_text"
    "$vs_code_rhel_binary_path" $@ &> /dev/null 2>&1

    echo """
Full Path: $(realpath "$@")
    """
  fi
}

code-list-extensions(){
  code --list-extensions
}

code-install-extension(){
  code --install-extension $@
}

##########################################################
#############  SECTION BREAK
##########################################################


##########################################################
# fzf - more advanced functions
# https://github.com/junegunn/fzf/wiki/examples
##########################################################
alias gco=fuzzyGitCobranch
alias gbranch=gco
alias gbr=gco
alias glog=fuzzyGitShow
alias gl=glog

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

    echo "$editorCmd $@"
    $editorCmd $@
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


getMakeComponentOptions(){
  make-help
}


# create the syle bookmark file
touch $HOME/.syle_bookmark

getCommandFromBookmark(){
  cat $HOME/.syle_bookmark
}

addCommandToBookmarks(){
  echo $@ >> $HOME/.syle_bookmark
  echo "Bookmarking '"$@"'"
  removeDuplicateLines ~/.syle_bookmark > /tmp/syle-bookmark-temp
  cat /tmp/syle-bookmark-temp > ~/.syle_bookmark

  # remove the temp file
  rm /tmp/syle-bookmark-temp
}

fuzzyMakeComponent(){
  makeComponentCommand=$(( \
  getMakeComponentOptions \
  ) | sed '/^\s*$/d' | uniq | fzf)
  echo "$makeComponentCommand"
  $makeComponentCommand
}


fuzzyFavoriteCommand(){
  makeComponentCommand=$(( \
  getCommandFromBookmark
  ) | sed '/^\s*$/d' | uniq | fzf)
  echo "$makeComponentCommand"

  # run the command
  $makeComponentCommand

  # put the command into history
  history -s "$makeComponentCommand"
}

# different completion trigger
export FZF_COMPLETION_TRIGGER='*'

##########################################################
#############  SECTION BREAK
##########################################################
killAllDockerContainers(){
  docker kill $(docker ps -q)
}

##########################################################
####################  Prompt  ##############
##########################################################
# get current branch in git repo
parse_git_branch(){
python << END
import commands
try:
  status, output = commands.getstatusoutput("git branch")
  output = output.split('\n')
  for branch in output:
    if '*' in branch:
      print('[' + branch[2:] + ']')
except:
  print('')
END
}


ifconfig2(){
python << END
import socket
try:
  s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  s.connect(('8.8.8.8', 1))
  local_ip_address = s.getsockname()[0]
  print(local_ip_address)
except:
  print('N/A')
END
}

#short path
shorter_pwd_path(){
python << END
import os
dir_path = os.path.dirname(os.path.realpath(__file__))
full_tokens = dir_path.split('/')
short_tokens = []
for idx, full_token in enumerate(full_tokens):
  if full_token:
    if idx != len(full_tokens) - 1:
      short_tokens.append(full_token[0])
    else:
      short_tokens.append(full_token)
print('/' + '/'.join(short_tokens))
END
}


#bash prompt
export PS1="
\[\e[31m\]====\[\e[m\]
\[\e[33m\]\T\[\e[m\] \[\e[36m\]\u\[\e[m\] @ \[\e[32m\]\h\[\e[m\] - \`ifconfig2\`
\[\e[33m\]\`shorter_pwd_path\`\[\e[m\] \[\e[31m\]\`parse_git_branch\`\[\e[m\]
\[\e[33m\]>\[\e[m\]\[\e[31m\]>\[\e[m\]\[\e[36m\]>\[\e[m\] "
