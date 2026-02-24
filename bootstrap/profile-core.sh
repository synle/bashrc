#! /bin/sh
export EDITOR='vim'

export BASH_PATH=~/.bashrc

# add sbin to path
export PATH=$PATH:/sbin

##########################################################
# Shared prompt/br style
##########################################################
_PROMPT_BLOCK="##########"
_PROMPT_COLORS=(91 93 92 96 94 95)
_PROMPT_BREAK="\[\e[1;91m\]$_PROMPT_BLOCK\[\e[1;93m\]$_PROMPT_BLOCK\[\e[1;92m\]$_PROMPT_BLOCK\[\e[1;96m\]$_PROMPT_BLOCK\[\e[1;94m\]$_PROMPT_BLOCK\[\e[1;95m\]$_PROMPT_BLOCK\[\e[m\]"

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
alias grep='grep --color'
alias gr='grep -i'

# git aliases
alias merge="git fetch --all --prune && git merge"
alias merge_master="merge origin/master"
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
  activate_py
  python "$@"
}

pi() {
  activate_py
  pip install -r "$@"
}

activate_py(){
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


rainbow_print() {
    # 1. Determine the color set
    # If $1 is provided and looks like a list of numbers, use it.
    # Otherwise, fall back to the global _PROMPT_COLORS.
    local colors
    if [[ -n "$1" && "$1" =~ ^[0-9[:space:]]+$ ]]; then
        colors=($1)
        shift # Remove colors from arguments so $1 becomes the text
    else
        colors=("${_PROMPT_COLORS[@]}")
    fi

    # 2. Get the input text (from remaining $1 or stdin)
    local input="${1:-$(cat -)}"
    local color_count=${#colors[@]}

    # 3. Print
    for (( i=0; i<${#input}; i++ )); do
        local color_idx=$(( i % color_count ))
        local color=${colors[$color_idx]}
        printf "\e[%sm%s\e[0m" "$color" "${input:$i:1}"
    done
    echo
}

# How to use it:
# Default behavior (Clears screen, prints 5 blocks):
# br
# Print 10 blocks (Still clears screen):
# br 10
# Print 3 blocks WITHOUT clearing:
# br 3 no-clear
# Print the default 5 blocks WITHOUT clearing:
# br 5 no-clear
br() {
    local repeat_count=${1:-5}
    local clear_flag=${2:-"clear"}
    local reverse_flag=${3:-"normal"}

    [[ "$clear_flag" != "no-clear" ]] && clear

    local colors=("${_PROMPT_COLORS[@]}")

    if [[ "$reverse_flag" == "reverse" ]]; then
        local reversed=()
        for ((i=${#colors[@]}-1; i>=0; i--)); do
            reversed+=("${colors[i]}")
        done
        colors=("${reversed[@]}")
    fi

    local line=""
    for ((i=0; i<repeat_count; i++)); do
        line+="$_PROMPT_BLOCK"
    done

    # Pass the local color array as a space-separated string
    echo "$line" | rainbow_print "${colors[*]}"
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
  # clean up
  git stash;
  git clean -fd
  git reset --hard
  git fetch --all --prune

  TEMP_BRANCH=test_123_abc_xyz
  git checkout $TEMP_BRANCH
  git checkout -b $TEMP_BRANCH
  git del master main

  # Track if it exists on origin
  git rev-parse --verify origin/master >/dev/null 2>&1 && git checkout --track origin/master;
  git rev-parse --verify origin/main >/dev/null 2>&1 && git checkout --track origin/main;
}

##########################################################
# Search Functions
##########################################################

# Search for files matching a pattern in the current directory (case-insensitive)
# Usage: search_file <pattern>
search_file(){
  if [ "$1" = "/help" ] || [ "$1" = "/?" ]; then
    ech """
      Usage: search_file <pattern>
        Searches for files matching <pattern> (case-insensitive) in the current directory.
    """
    return 0
  fi
  find . -type f -iname "*$@*" | filter_unwanted | grep -i "$@"
}

# List all tracked files (via git) or all files (via find) in the current directory
# Usage: search_file_with_git
search_file_with_git(){
  if [ "$1" = "/help" ] || [ "$1" = "/?" ]; then
    ech """
      Usage: search_file_with_git
        Lists all tracked files using git ls-tree, falls back to find if not in a git repo.
    """
    return 0
  fi
  # use either ls tree or find
  git ls-tree -r --name-only HEAD 2> /dev/null || \
  find . -type f 2>/dev/null \
  | uniq
}

# List all directories (excluding hidden) from a given path, defaults to current directory
# Usage: search_dir_with_git [path]
search_dir_with_git(){
  if [ "$1" = "/help" ] || [ "$1" = "/?" ]; then
    ech """
      Usage: search_dir_with_git [path]
        Lists all directories (excluding hidden) from [path], defaults to current directory.
    """
    return 0
  fi
  find ${1:-.} -path '*/\.*' -prune \
  -o -type d -print 2> /dev/null
  echo ".." # append parent folder
}

# Search for directories matching a pattern in the current directory (case-insensitive)
# Usage: search_dir <pattern>
search_dir(){
  if [ "$1" = "/help" ] || [ "$1" = "/?" ]; then
    ech """
      Usage: search_dir <pattern>
        Searches for directories matching <pattern> (case-insensitive) in the current directory.
    """
    return 0
  fi
  find . -type d -iname "*$@*" | filter_unwanted | grep -i "$@"
}

##########################################################
# Filter Functions
##########################################################
filter_unwanted(){
  grep -v "\.DS_Store" \
  | grep -v "\.git/" \
  | grep -v "node_modules" \
  | grep -v "bower_components" \
  | grep -v "__pycache__" \
  | grep -v "\.pyc$" \
  | grep -v "/venv/" \
  | grep -v "/\.venv/" \
  | grep -v "/dist/" \
  | grep -v "/build/" \
  | grep -v "/\.next/" \
  | grep -v "/\.cache/" \
  | grep -v "/coverage/" \
  | grep -v "/\.idea/" \
  | grep -v "/\.gradle/" \
  | grep -v "/target/" \
  | uniq
}

filter_text_files_only(){
  filter_unwanted \
  | grep -v "\.jpeg$" \
  | grep -v "\.jpg$" \
  | grep -v "\.png$" \
  | grep -v "\.gif$" \
  | grep -v "\.ico$" \
  | grep -v "\.bmp$" \
  | grep -v "\.webp$" \
  | grep -v "\.svg$" \
  | grep -v "\.mp4$" \
  | grep -v "\.mp3$" \
  | grep -v "\.mov$" \
  | grep -v "\.zip$" \
  | grep -v "\.tar$" \
  | grep -v "\.gz$" \
  | grep -v "\.rar$" \
  | grep -v "\.pdf$" \
  | grep -v "\.woff2\?$" \
  | grep -v "\.ttf$" \
  | grep -v "\.eot$" \
  | grep -v "\.jar$" \
  | grep -v "\.class$" \
  | grep -v "\.exe$" \
  | grep -v "\.dll$" \
  | grep -v "\.so$" \
  | grep -v "\.dylib$" \
  | uniq
}

##########################################################
# Chmod Calculator
##########################################################
chmod_calculator(){
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
alias calc_chmod='chmod_calculator'

##########################################################
# FZF Lightweight Aliases and Functions
##########################################################
alias fv=fuzzy_vim
alias fvim=fuzzy_vim
alias fview=fuzzy_view_file
alias fcd=fuzzy_directory

# simple view file alias - will be overridden by advanced bash
view_file(){
  vim "$@"
}

fuzzy_vim(){
  local OUT=$( \
    search_file_with_git | \
    filter_text_files_only | \
    fzf \
  )

  if [ -n "$OUT" ]; then
    echo """
vim \"$OUT\"
    """
    vim "$OUT"
  fi
}

fuzzy_view_file(){
  local OUT=$( \
    search_file_with_git | \
    filter_text_files_only | \
    fzf \
  )

  if [ -n "$OUT" ]; then
    echo """
view_file \"$OUT\"
    """
    view_file "$OUT"
  fi
}

fuzzy_directory(){
  local OUT=$( \
    search_dir_with_git | \
    filter_unwanted | \
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
## Returns HH:MM:SS AM/PM with colored AM/PM indicator
# AM = bright white (light), PM = dark gray (dark)
# Uses \001/\002 for PS1-safe non-printing character wrapping
get_time() {
  local tz=${1:-""}
  local time_str ampm

  if [ "$tz" = "UTC" ]; then
    time_str=$(date -u +'%I:%M:%S')
    ampm=$(date -u +'%p')
  elif [ -n "$tz" ]; then
    time_str=$(TZ="$tz" date +'%I:%M:%S')
    ampm=$(TZ="$tz" date +'%p')
  else
    time_str=$(date +'%I:%M:%S')
    ampm=$(date +'%p')
  fi

  if [ "$ampm" = "AM" ]; then
    printf '%s\001\e[1;97m\002%s\001\e[m\002' "$time_str" "$ampm"
  else
    printf '%s\001\e[0;90m\002%s\001\e[m\002' "$time_str" "$ampm"
  fi
}

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
# "\$(br 5 no-clear reverse | sed 's/\(\x1b\[[0-9;]*m\)/\\\[\1\\\]/g')"
##########################################################
# 08:31:59PM U=04:31:59AM syle @ Sy-Omen45L
# ~/git/bashrc
# >>>
export PS1_Simple="
\[\e[1;93m\]\$(get_time) \[\e[1;95m\]U=\$(get_time \"UTC\") \[\e[1;96m\]\u\[\e[m\] @ \[\e[1;92m\]\h\[\e[m\]
\[\e[1;31m\]\w\[\e[m\]
\$(rainbow_print '>>>' | sed 's/\(\x1b\[[0-9;]*m\)/\\\[\1\\\]/g') "
export PS1="$PS1_Simple"
