# software/bootstrap/profile-core.sh
export EDITOR='vim'
export BASH_PATH=~/.bash_syle

# add known paths to PATH if they exist
path_candidates=(
  # common (linux / mac / wsl)
  /bin                                  # core system binaries
  /sbin                                 # core system admin binaries
  /usr/bin                              # standard unix binaries
  /usr/sbin                             # standard unix admin binaries
  /usr/local/bin                        # user-installed binaries
  /usr/local/sbin                       # local admin binaries
  ~/.cargo/bin                          # rust / cargo
  ~/.fzf/bin                            # fzf fuzzy finder
  ~/.local/bin                          # pip / user-local binaries
  ~/.volta/bin                          # volta node version manager
  ~/miniconda3/bin                      # miniconda python
  ~/miniconda3/condabin                 # conda command
  # mac
  /opt/homebrew/bin                     # homebrew (apple silicon)
  /opt/homebrew/sbin                    # homebrew admin (apple silicon)
  /usr/local/Homebrew/bin               # homebrew (intel mac)
  # wsl / linux
  /snap/bin                             # snap packages
  /usr/games                            # linux game binaries
  /usr/local/games                      # local game binaries
  /usr/lib/wsl/lib                      # wsl gpu / system libs
)

# append each path if the directory exists
for p in "${path_candidates[@]}"; do
  expanded="${p/#\~/$HOME}"
  if [ -d "$expanded" ]; then
    export PATH="$PATH:$expanded"
  fi
done

# dedupe PATH while preserving order
export PATH="$(echo "$PATH" | tr ':' '\n' | awk '!seen[$0]++' | tr '\n' ':' | sed 's/:$//')"
unset path_candidates

################################################################################
# ---- History ----
################################################################################
export HISTSIZE=80000
export HISTFILESIZE=80000
export HISTTIMEFORMAT="[%F %T] "
export HISTCONTROL=ignoreboth  # avoid duplicate entries and commands starting with space
shopt -s histappend  # append instead of overwrite history file
shopt -s cmdhist  # save multi-line commands as one entry

# command to ignore in the list
ignored_history=(
  "ls"
  "ll"
  "l"
  "cd"
  "cd *"
  ".."
  "cd ."
  "cd ..*"
  "pwd"
  "exit"
  "clear"
  "br"
  "history"
  "git add*"
  "git commit*"
  "git amend*"
  "git push*"
  "git pull*"
  "git stash*"
  "git checkout*"
  "git status"
  "git diff"
  "git log"
  "git fetch*"
)
export HISTIGNORE=$(IFS=":"; echo "${ignored_history[*]}")
unset ignored_history

################################################################################
# ---- Track Visited Directories ----
# Maintains a list of recently visited directories in
# RECENT_PATHS_FILE. The list is capped at RECENT_PATHS_MAX
# entries, most recent first, deduplicated, and auto-pruned
# of directories that no longer exist.
#
# Used by:
#   _track_pwd - runs via PROMPT_COMMAND after every command
#   _recent_paths - reads and cleans the paths file
#   golast - cd to the most recently visited directory
#   fuzzy_paths (fp) - fzf picker for visited directories
################################################################################
RECENT_PATHS_FILE=~/.bash_syle_paths
RECENT_PATHS_MAX=100

# reads the paths file, removes entries that no longer exist, and outputs the cleaned list
_recent_paths() {
  local tmp="/tmp/.bash_syle_paths_tmp"
  while IFS= read -r dir; do
    [ -d "$dir" ] && echo "$dir"
  done < "$RECENT_PATHS_FILE" 2>/dev/null > "$tmp"
  mv "$tmp" "$RECENT_PATHS_FILE"
  cat "$RECENT_PATHS_FILE"
}

# prepends the current directory to the paths file (deduped, capped at RECENT_PATHS_MAX)
# skips home directory. runs automatically via PROMPT_COMMAND.
_track_pwd() {
  local current="$(pwd)"
  [ "$current" = "$HOME" ] && return
  local tmp="/tmp/.bash_syle_paths_tmp"
  echo "$current" | cat - "$RECENT_PATHS_FILE" 2>/dev/null | awk '!seen[$0]++' | head -n "$RECENT_PATHS_MAX" > "$tmp"
  mv "$tmp" "$RECENT_PATHS_FILE"
}

# cd to the most recently visited directory
golast() {
  local dir
  dir=$(_recent_paths | head -1)
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    cd "$dir"
  else
    echo "golast: no valid path found"
  fi
}

# write + reload history after every command (share history across terminals)
# Before every prompt — meaning after every command you run and right before bash shows >>> again.
# Example flow:
# 1. You type ls and hit Enter
# 2. ls runs
# 3. Bash runs everything in PROMPT_COMMAND
# 4. Bash displays your prompt (>>>)
# 5. You type next command...
PROMPT_COMMAND="_track_pwd; history -a; history -c; history -r;${PROMPT_COMMAND}"


################################################################################
# ---- Custom Bash autocomplete filters for commands and file patterns ----
################################################################################
ignored_commands=(
  "*/clean-staging"
  "*/CleanPCCSP.dll"
  "*/cleanmgr.exe"
  "*/clear_console"
  "*/clear"
)
ignored_files=(
  ".rej"
  ".pyc"
  ".tmp"
  ".DS_Store"
)
cmd_string=$(printf ":%s" "${ignored_commands[@]}")
file_string=$(printf ":%s" "${ignored_files[@]}")
export EXECIGNORE="$EXECIGNORE${cmd_string}"
export FIGNORE="$FIGNORE${file_string}"
unset ignored_commands cmd_string ignored_files file_string

################################################################################
# ---- Common Aliases ----
################################################################################
alias ..="cd .."
alias bs="bash"
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
alias clear='/usr/bin/clear'

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

################################################################################
# ---- Utility Functions ----
################################################################################
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


rainbow_block="##########"
rainbow_colors=(91 93 92 96 94 95)

rainbow_print() {
    # 1. Determine the color set
    # If $1 is provided and looks like a list of numbers, use it.
    # Otherwise, fall back to the global rainbow_colors.
    local colors
    if [[ -n "$1" && "$1" =~ ^[0-9[:space:]]+$ ]]; then
        colors=($1)
        shift # Remove colors from arguments so $1 becomes the text
    else
        colors=("${rainbow_colors[@]}")
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

    local colors=("${rainbow_colors[@]}")

    if [[ "$reverse_flag" == "reverse" ]]; then
        local reversed=()
        for ((i=${#colors[@]}-1; i>=0; i--)); do
            reversed+=("${colors[i]}")
        done
        colors=("${reversed[@]}")
    fi

    local line=""
    for ((i=0; i<repeat_count; i++)); do
        line+="$rainbow_block"
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

npm() {
  case "${1-}" in
    ""|-*|access|adduser|audit|bugs|cache|ci|completion|config|dedupe|deprecate|diff|dist-tag|\
    doctor|edit|exec|explain|explore|find-dupes|fund|get|help|hook|init|install|install-ci-test|\
    install-test|link|ll|login|logout|ls|org|outdated|owner|pack|ping|pkg|prefix|profile|\
    prune|publish|query|rebuild|repo|restart|root|run|run-script|search|set|shrinkwrap|\
    star|stars|start|stop|team|test|token|uninstall|unpublish|unstar|update|version|view|whoami|i)
      command npm "$@" ;;
    *) command npm run "$@" ;;
  esac
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


################################################################################
# ---- Git Helpers ----
################################################################################
# Resets the working tree, deletes local master/main, and re-tracks the default branch from origin (preferring master over main).
clean_master_main_branch() {
  git stash >/dev/null 2>&1
  git clean -fd >/dev/null 2>&1
  git reset --hard HEAD >/dev/null 2>&1
  git merge --abort >/dev/null 2>&1
  git rebase --abort >/dev/null 2>&1
  git cherry-pick --abort >/dev/null 2>&1
  git am --abort >/dev/null 2>&1
  git fetch --all --prune >/dev/null 2>&1
  rm -rf .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD

  local temp_branch_name="tmp-clean-$(date +%s)"
  git checkout -B "$temp_branch_name" >/dev/null 2>&1
  git branch -D master main >/dev/null 2>&1

  for b in master main; do
    if git rev-parse --verify "origin/$b" >/dev/null 2>&1; then
      git checkout --track "origin/$b" >/dev/null 2>&1
      break
    fi
  done

  git branch -D "$temp_branch_name" >/dev/null 2>&1

  echo "$(git log -1 --format='%h %an: %s' HEAD) ($(git branch --show-current))"
  git diff --stat HEAD~1
}

# Creates an empty commit on a new branch and pushes it to trigger a deployment.
commit_empty_trigger_deploy() {
  local temp_branch_name="empty-commit-$(date +%s)"
  git checkout -b "$temp_branch_name" >/dev/null 2>&1
  git commit --allow-empty -m "Trigger deployment - EMPTY PR" >/dev/null 2>&1
  git push -u origin "$temp_branch_name" >/dev/null 2>&1
}

# Go to git home $MY_GIT_HOME
function gogit(){
  local git_home="${MY_GIT_HOME:-$HOME/git}"
  cd "$git_home" 2>/dev/null || echo "gogit: $git_home is not present"
}

################################################################################
# ---- Search Functions ----
################################################################################
search_file() {
  local pattern
  pattern=$(_require_search_input "$@") || return 0
  find . -type f -iname "*$pattern*" | filter_unwanted | grep -i "$pattern"
}

# Lists all tracked files via git, falls back to find if not in a git repo.
search_file_with_git() {
  git ls-tree -r --name-only HEAD 2>/dev/null || find . -type f 2>/dev/null | uniq
}

# Lists all directories (excluding hidden) from a given path, defaults to current directory.
search_dir_with_git() {
  find "${1:-.}" -path '*/.*' -prune -o -type d -print 2>/dev/null
  echo ".."
}

# Searches for directories matching a pattern in the current directory (case-insensitive).
search_dir() {
  local pattern
  pattern=$(_require_search_input "$@") || return 0
  find . -type d -iname "*$pattern*" | filter_unwanted | grep -i "$pattern"
}

# Returns the input text, prompting the user interactively if none was provided.
_require_search_input() {
  if [ -n "$*" ]; then
    echo "$*"
  else
    read -rp "Enter search pattern: " input
    if [ -z "$input" ]; then
      echo "No input provided." >&2
      return 1
    fi
    echo "$input"
  fi
}


################################################################################
# ---- Filter Functions ----
################################################################################
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

################################################################################
# ---- Chmod Calculator ----
################################################################################
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

################################################################################
# ---- FZF Lightweight Aliases and Functions ----
################################################################################
alias fv=fuzzy_vim
alias fvim=fuzzy_vim
alias fview=fuzzy_view_file
alias fcd=fuzzy_directory
alias fp=fuzzy_paths

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

_fuzzy_cd() {
  local OUT=$(echo "$1" | fzf +m)
  if [ -n "$OUT" ] && [ -d "$OUT" ]; then
    echo "cd \"$OUT\""
    cd "$OUT"
  fi
}

fuzzy_directory(){
  _fuzzy_cd "$(search_dir_with_git | filter_unwanted)"
}

fuzzy_paths(){
  _fuzzy_cd "$(_recent_paths)"
}

################################################################################
# ---- Date / Time ----
################################################################################
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

################################################################################
# ---- Telemetry / Environment ----
################################################################################
export FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT="1" # opt out azure cli telemetry

# for ssh socket control
mkdir -p ~/.ssh/sockets

# # Point Claude to your local Ollama port
# export ANTHROPIC_BASE_URL="http://localhost:11434"
# export ANTHROPIC_AUTH_TOKEN="ollama"
# export ANTHROPIC_API_KEY="local-development"

################################################################################
# ---- Prompt ----
# "\$(br 5 no-clear reverse | sed 's/\(\x1b\[[0-9;]*m\)/\x01\1\x02/g')"
################################################################################
# 08:31:59PM U=04:31:59AM syle @ Sy-Omen45L
# ~/git/bashrc
# >>>
export PS1_Simple="\n\
\[\e[1;93m\]\$(get_time) \
\[\e[1;95m\]U=\$(get_time \"UTC\") \
\[\e[1;96m\]\u\[\e[m\] @ \
\[\e[1;92m\]\h\[\e[m\]\n\
\[\e[1;31m\]\w\[\e[m\]\n\
>>> "
export PS1="$PS1_Simple"
