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
alias apt='sudo apt-get'

### format related
alias format='format_cleanupl; format_pythonl; format_js'

format_js() {
  echo "🎨 Running Prettier on JavaScript/TypeScript files..."

  # Ensure Node is available
  if ! command -v npx >/dev/null 2>&1; then
    echo "❌ npx not found. Please install Node.js (https://nodejs.org/) first."
    return 1
  fi

  # Run Prettier with ignore rules
  npx prettier --write '**/*.{js,jsx,ts,tsx,json,scss,mjs,html,md}' --ignore-path .gitignore

  if [ $? -eq 0 ]; then
    echo "✅ JS/TS formatting complete."
  else
    echo "⚠️ Prettier encountered some errors."
    return 1
  fi
}

format_python() {
  # Try to activate a Python virtual environment, preferring local first
  if [ -f ".venv/bin/activate" ]; then
    echo "🐍 Activating local virtual environment (.venv)..."
    source .venv/bin/activate
  elif [ -f "/home/syle/venv/bin/activate" ]; then
    echo "🐍 Activating fallback environment (/home/syle/venv)..."
    source /home/syle/venv/bin/activate
  else
    echo "⚠️ No virtual environment found. Using global Python."
  fi

  # Ensure Ruff is available in the current environment
  if ! command -v ruff >/dev/null 2>&1; then
    echo "📦 Installing Ruff..."
    pip install ruff || { echo "❌ Failed to install Ruff."; return 1; }
  fi

  echo "🧹 Running Ruff checks and formatting..."
  ruff format --line-length 160 --exclude ".git,node_modules,venv,.venv" || return 1
  ruff check --fix --line-length 160 --exclude ".git,node_modules,venv,.venv" || return 1

  echo "✅ Python formatting complete."
}

format_cleanup() {
  echo "🧹 Cleaning up system junk files (.DS_Store, .Identifier, Apple resource forks)..."

  # Define the base directory (default: current)
  local base_dir="${1:-.}"

  # Ensure the directory exists
  if [ ! -d "$base_dir" ]; then
    echo "❌ Directory '$base_dir' not found."
    return 1
  fi

  # Perform cleanup safely
  find "$base_dir" \
    -type f \( -name '*.Identifier' -o -name '.DS_Store' -o -name '._*' \) \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/venv/*' \
    -not -path '*/.venv/*' \
    -not -path '*/__pycache__/*' \
    -delete

  echo "✅ Cleanup complete in: $base_dir"
}

# bat / cat setup
batcatfull() {
    # Try the 'bat' command first
    bat "$@" 2>/dev/null
    if [ $? -ne 0 ]; then
        # If 'bat' fails, try the 'batcat' command
        batcat "$@" 2>/dev/null
    fi
}
alias bat='batcatfull -p --paging=never'

# define pbpaste and pbcopy - define_pbcopy_pbpaste
if ! command -v pbcopy &>/dev/null; then
    pbcopy() { xclip -selection clipboard; }
    export -f pbcopy
fi

if ! command -v pbpaste &>/dev/null; then
    pbpaste() { xclip -selection clipboard -o; }
    export -f pbpaste
fi


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
  executed_flag=false

  local sublime_binaries=(
    "/mnt/c/Program Files/Sublime Text/sublime_text.exe"
    "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl"
    "/opt/sublime_text/sublime_text"
  )

  for binary in "${sublime_binaries[@]}"; do
    if [[ -x "$binary" ]]; then
      echo $binary "$@"
      if [[ "$executed_flag" = false ]]; then
        # Run the binary and set the flag to true
        "$binary" $@ &> /dev/null 2>&1
        executed_flag=true
      else
        noop # noop
      fi
    fi
  done

  echo """
============
PWD: $(pwd)
Full Path: $(realpath .)
  """
}


code()
{
  executed_flag=false

  local vscode_binaries=(
    "/mnt/c/Program Files/VSCodium/VSCodium.exe"
    "/mnt/c/Program Files/Microsoft VS Code/Code.exe"
    "/usr/local/bin/codium"
    "/usr/local/bin/code"
    "/usr/bin/codium"
    "/usr/bin/code"
  )

  for binary in "${vscode_binaries[@]}"; do
    if [[ -x "$binary" ]]; then
      echo $binary "$@"
      if [[ "$executed_flag" = false ]]; then
        # Run the binary and set the flag to true
        "$binary" $@ &> /dev/null 2>&1
        executed_flag=true
      else
        noop # noop
      fi
    fi
  done

  echo """
============
PWD: $(pwd)
Full Path: $(realpath .)
  """
}

codeListExtensions(){
  code --list-extensions
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

  editorCmd=subl
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


#bash prompt
export PS1="
\[\e[31m\]====\[\e[m\]
\[\e[33m\]\T\[\e[m\] \[\e[36m\]\u\[\e[m\] @ \[\e[32m\]\h\[\e[m\] - \`ifconfig2\`
\[\e[33m\]\`shorterPwdPath\`\[\e[m\] \[\e[31m\]\`parseGitBranch\`\[\e[m\]
\[\e[33m\]>\[\e[m\]\[\e[31m\]>\[\e[m\]\[\e[36m\]>\[\e[m\] "
