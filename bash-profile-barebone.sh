#! /bin/sh
export EDITOR='vim'

export BASH_PATH=~/.bashrc

# add sbin to path
export PATH=$PATH:/sbin

##########################################################
# History
##########################################################
export HISTSIZE=5000
export HISTFILESIZE=10000
export HISTTIMEFORMAT="[%F %T] "
# Force prompt to write history after every command.
# http://superuser.com/questions/20900/bash-history-loss
PROMPT_COMMAND="history -a; $PROMPT_COMMAND"

##########################################################
# Common Aliases
##########################################################
alias ..="cd .."
alias v="vim"
alias vi="vim"
alias l="ls -a"
alias ls="ls -1"
alias ll="ls -la"
alias g="git"
alias gg="git --no-pager"
alias n="node"
alias y="yarn"
alias s='ssh -4'
alias b="bat --style=plain"
alias cu="curl -H 'Cache-Control: no-cache, no-store' -H 'Pragma: no-cache'"
alias fzf='fzf --no-sort'
alias search='searchText'
alias grep='grep --color'
alias gr='grep -i'

# git aliases
alias merge="git fetch --all --prune && git merge"
alias mergeMaster="merge origin/master"
alias pp="pi"

# python aliases
alias pytest="python -m pytest"
alias pytest-single="python -m pytest -vvl -k"
alias flake="flake8"
alias flake8="python -m flake8"

# claude aliases
alias cl="claude --dangerously-skip-permissions"
alias c="cl"
alias cm='cl --model opus'

##########################################################
# Utility Functions
##########################################################
# short form echo that removes leading + trailing blank lines,
# finds the first non-empty line, detects its indentation,
# and trims that indentation from all lines
ech() {
  printf '%s' "$@" \
  | sed -e '1{/^[[:space:]]*$/d;}' -e '${/^[[:space:]]*$/d;}' \
  | awk 'NR==1{
      match($0,/^[[:space:]]*/);
      indent=RLENGTH
    }
    {
      sub("^[[:space:]]{0," indent "}","")
    }1'
}

p() {
  activatePy
  python "$@"
}

pi() {
  activatePy
  pip install -r "$@"
}

activatePy(){
  # Check if Python virtual environment is already activated
  if [[ -z "$VIRTUAL_ENV" ]]; then
    # Try activating local venv first
    if [[ -f "./venv/bin/activate" ]]; then
      source ./venv/bin/activate
    # Then try user home venv
    elif [[ -f "$HOME/venv/bin/activate" ]]; then
      source "$HOME/venv/bin/activate"
    fi
  fi
}

br() {
  clear
  local repeat_count=${1:-1} # default to -1
  local colors=(91 93 92 96 94 95)
  local block="##=============##"

  # High-Contrast Bold color codes
  local num_colors=${#colors[@]}

  for ((i=0; i<repeat_count; i++)); do
    local line=""

    for ((j=0; j<num_colors; j++)); do
      local color_idx=$(( (i + j) % num_colors ))
      local color_code="${colors[$color_idx]}"

      # Use the $'...' syntax here to "bake" the escape code into the string
      line+=$'\e[1;'"${color_code}m${block}"
    done

    # Reset color and print. No -e needed because the variable is already escaped.
    echo "${line}"$'\e[m'
  done
}

# # Usage:
# spinner &        # Start spinner in the background
# SPIN_PID=$!      # Get the Process ID
# sleep 3          # Simulate a long command
# kill $SPIN_PID   # Stop the spinner
# echo "Done!"
spinner() {
  local chars="/-\|"
  # Using your preferred high-contrast neon colors
  local colors=(91 93 92 96 94 95)
  local c_idx=0

  # Hide the cursor so it looks cleaner
  tput civis

  # Trap to restore the cursor if you hit Ctrl+C
  trap "tput cnorm; exit" SIGINT

  while true; do
    for (( i=0; i<${#chars}; i++ )); do
      local color="${colors[$c_idx]}"

      # Print the character in the current neon color
      echo -ne $'\e[1;'"${color}m${chars:$i:1}"$'\e[m'"\r"

      sleep 0.1

      # Move to the next color in the array
      c_idx=$(( (c_idx + 1) % ${#colors[@]} ))
    done
  done
}

renpm(){
  rm -rf node_modules bower_components /tmp/*.cache;
  npm install
}

tree(){
  find . -type d | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/"
}

pwd2() {
  echo '===== pwd ===================================='
  command pwd

  echo "cd \"$(command pwd)\""
  echo '=============================================='
}


##########################################################
# Git Helpers
##########################################################
clean_master_main_branch(){
    git stash;
    git clean fd
    git reset --hard;
    git fap;
    git checkout test;
    git checkout -b test;
    git del master main;
    git checkout --track origin/master;
    git checkout --track origin/main
}

##########################################################
# Search Functions
##########################################################
searchHelp(){
  echo '''
searchCode ""

searchFile ""

searchFileWithGit ""

searchDirWithGit ""

searchDir ""
  '''
}

searchCode(){
  echo """
Searching:  $@
#############################################################
  """

  grep -r -o -n "$@" \
    --include=*.{*.hbs,*.jsx,*.js,*.tsx,*.ts,*.css,*.scss,*.less,*.scala,*.html,*.java,*.py} \
    --exclude=*.{png,jpg,.gitignore,.DS_Store} \
    --exclude-dir={node_modules,.git} \
  .
}

searchFile(){
  find . -type f -iname "*$@*" | filterUnwantedLight | grep -i "$@"
}

searchFileWithGit(){
  # use either ls tree or find
  git ls-tree -r --name-only HEAD 2> /dev/null || \
  find . -type f 2>/dev/null \
  | uniq
}

searchDirWithGit(){
  find ${1:-.} -path '*/\.*' -prune \
  -o -type d -print 2> /dev/null
  echo ".." # append parent folder
}

searchDir(){
  find . -type d -iname "*$@*" | filterUnwantedLight | grep -i "$@"
}

##########################################################
# Filter Functions
##########################################################
filterUnwantedLight(){
  grep -v "\.DS_Store" \
  | grep -v "\.git/" \
  | grep -v "node_modules" \
  | uniq
}

filterTextFilesOnly(){
  filterUnwantedLight \
  | grep -v "\.jpeg" \
  | grep -v "\.jpg" \
  | grep -v "\.png" \
  | uniq
}

alias filterUnwanted='filterUnwantedLight'

##########################################################
# Chmod Calculator
##########################################################
chmodCalculator(){
  node -e """
    console.log('Chmod Calculator - Enter permission for x w r:');
    var stdin = process.openStdin();
    stdin.addListener('data', (d) => {
      console.log('Value:', _getValue((d).toString().toLowerCase().trim()))
      process.exit();
    });
    const _getValue = (str) => {
      if(str.length === 0 || str.length > 3){
        return 'Invalid';
      }

      return [...str].reduce((val, c) => {
        if(c === 'x'){ val += 1; }
        if(c === 'w'){ val += 2; }
        if(c === 'r'){ val += 4; }
        return val;
      }, 0)
    };
  """
}
alias calcChmod='chmodCalculator'

##########################################################
# FZF Lightweight Aliases and Functions
##########################################################
alias fv=fuzzyVim
alias fvim=fuzzyVim
alias fview=fuzzyViewFile
alias fcd=fuzzyDirectory

# simple view file alias - will be overridden by advanced bash
viewFile(){
  vim "$@"
}

fuzzyVim(){
  local OUT=$( \
    searchFileWithGit | \
    filterTextFilesOnly | \
    fzf \
  )

  if [ -n "$OUT" ]; then
    echo """
vim \"$OUT\"
    """
    vim "$OUT"
  fi
}

fuzzyViewFile(){
  local OUT=$( \
    searchFileWithGit | \
    filterTextFilesOnly | \
    fzf \
  )

  if [ -n "$OUT" ]; then
    echo """
viewFile \"$OUT\"
    """
    viewFile "$OUT"
  fi
}

fuzzyDirectory(){
  local OUT=$( \
    searchDirWithGit | \
    filterUnwanted | \
    fzf +m \
  );

  if [ -n "$OUT" ]; then
    echo """
PWD: $PWD
New_Dir: \"$OUT\"
    """
    cd "$OUT"
  fi
}

##########################################################
# Date / Time
##########################################################
date2(){
  # High-intensity colors for the labels
  echo $'\e[1;31m>> UTC\e[m'
  date -u +'%a, %b %d, %Y  %r'

  echo $'\e[1;96m>> PST (California)\e[m'
  TZ="America/Los_Angeles" date +'%a, %b %d, %Y  %r'

  echo $'\e[1;92m>> LOCAL\e[m'
  date +'%a, %b %d, %Y  %r'
}

##########################################################
# Timeout
##########################################################
timeout() {
  local delay cmd

  if [ "$#" -eq 1 ]; then
    delay=8
    cmd="$1"
  elif [ "$#" -eq 2 ]; then
    delay="$1"
    cmd="$2"
  else
    echo "usage: timeout [seconds] <command>"
    return 1
  fi

  (
    eval "$cmd" &
    cmd_pid=$!

    # watchdog
    (
      sleep "$delay"
      if kill -0 "$cmd_pid" 2>/dev/null; then
        echo "Timeout after ${delay}s: killing '$cmd'"
        kill -9 "$cmd_pid" 2>/dev/null
      fi
    ) &

    wait "$cmd_pid"
  )
}

##########################################################
# Telemetry / Environment
##########################################################
export FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT="1" # opt out azure cli telemetry

# for ssh socket control
mkdir -p ~/.ssh/sockets

# # Point Claude to your local Ollama port
# export ANTHROPIC_BASE_URL="http://localhost:11434"
# export ANTHROPIC_AUTH_TOKEN="ollama"
# export ANTHROPIC_API_KEY="local-development"

##########################################################
# Prompt
##########################################################
# Sun Feb 22 20:24:44 2026 syle @ Sy-G14-2023
# ~/git/bashrc
# >>>
# Define the template
export PS1_Simple="
\[\e[1;31m\]====\[\e[m\]
\[\e[1;93m\]\D{%c}\[\e[m\] \[\e[1;96m\]\u\[\e[m\] @ \[\e[1;92m\]\h\[\e[m\]
\[\e[1;97m\]\w\[\e[m\]
\[\e[1;93m\]>\[\e[m\]\[\e[1;31m\]>\[\e[m\]\[\e[1;36m\]>\[\e[m\] "

# Assign it
export PS1="$PS1_Simple"
