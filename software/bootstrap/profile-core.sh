# software/bootstrap/profile-core.sh
export EDITOR='vim'
export BASH_PATH=~/.bash_syle

################################################################################
# ---- PATH Setup ----
################################################################################
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
  "fuzzy_*"
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
#   fuzzy_paths - fzf picker for visited directories
################################################################################
RECENT_PATHS_FILE=~/.bash_syle_paths
RECENT_PATHS_MAX=100

# reads the paths file, removes entries that no longer exist, and outputs the cleaned list
function _recent_paths() {
  local tmp="/tmp/.bash_syle_paths_tmp"
  while IFS= read -r dir; do
    [ -d "$dir" ] && echo "$dir"
  done < "$RECENT_PATHS_FILE" 2>/dev/null > "$tmp"
  mv "$tmp" "$RECENT_PATHS_FILE"
  cat "$RECENT_PATHS_FILE"
}

# prepends the current directory to the paths file (deduped, capped at RECENT_PATHS_MAX)
# skips home directory. runs automatically via PROMPT_COMMAND.
function _track_pwd() {
  local current="$(pwd)"
  [ "$current" = "$HOME" ] && return
  local tmp="/tmp/.bash_syle_paths_tmp"
  echo "$current" | cat - "$RECENT_PATHS_FILE" 2>/dev/null | awk '!seen[$0]++' | head -n "$RECENT_PATHS_MAX" > "$tmp"
  mv "$tmp" "$RECENT_PATHS_FILE"
}

# cd to the most recently visited directory
function golast() {
  local dir
  dir=$(_recent_paths | head -1)
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    cd "$dir"
  else
    echo "golast: no valid path found"
  fi
}

# write + reload history after every command (share history across terminals)
PROMPT_COMMAND="_track_pwd; history -a; history -c; history -r;${PROMPT_COMMAND}"

################################################################################
# ---- Autocomplete Filters ----
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
# ---- Aliases: Navigation ----
################################################################################
alias ..="cd .."
alias clear='/usr/bin/clear'

# ---- Aliases: File Listing ----
alias ls="ls -1 -F --color"
alias ll="ls -lah"
alias ls_newest="ll -t"                  # sort by modification time (newest first)
alias ls_newest_last="ls_newest -r"      # sort by modification time (oldest first)
alias ls_biggest="ll -S"                 # sort by file size (biggest first)
alias ls_biggest_last="ls_biggest -r"    # sort by file size (smallest first)

# ---- Aliases: Editors / Tools ----
alias bs="bash"
alias vi="vim"
alias fzf='fzf --no-sort'
alias grep='grep --color'
alias cu="curl -H 'Cache-Control: no-cache, no-store' -H 'Pragma: no-cache'"

# ---- Aliases: Git ----
# git wrapper: invalidates branch cache on state-changing commands
function git() {
  command git "$@"
  case "${1-}" in
    # core commands
    checkout|switch|pull|push|fetch|merge|rebase|commit|reset|stash|cherry-pick|revert|am|apply)
      _invalidate_git_cache 2>/dev/null ;;
    # git aliases: commit (c, cm, amend, wip, unwip)
    c|cm|amend|amendm|wip|unwip)
      _invalidate_git_cache 2>/dev/null ;;
    # git aliases: checkout/branch (co, cob, del, gone)
    co|cob|del|gone)
      _invalidate_git_cache 2>/dev/null ;;
    # git aliases: pull/push/fetch (p, pu, po, pof, fap, fapr, track)
    p|pu|po|pof|fap|fapr|track)
      _invalidate_git_cache 2>/dev/null ;;
    # git aliases: rebase/merge/revert (r, rc, ri, rv, rvc, mc, cp, cpc, cpn)
    r|rc|ri|rv|rvc|mc|cp|cpc|cpn)
      _invalidate_git_cache 2>/dev/null ;;
    # git aliases: undo/cleanup (undo, cleanfd, patch)
    undo|cleanfd|patch)
      _invalidate_git_cache 2>/dev/null ;;
    # git aliases: status/branch/log/diff info
    s|stat|status|b|ba|del|branch|d|ds|dh|diff|l|ll|ls|lls|log)
      _invalidate_git_cache 2>/dev/null ;;
  esac
}
alias g="git"
alias gg="git --no-pager"
alias merge="git fetch --all --prune && git merge"
alias merge_master="merge origin/master"

# ---- Aliases: Node ----
alias n="node"
alias y="yarn"

# ---- Aliases: Python ----
alias pytest="python -m pytest"
alias pytest-single="python -m pytest -vvl -k"
alias flake="flake8"
alias flake8="python -m flake8"

# ---- Aliases: Claude ----
alias cl="claude --dangerously-skip-permissions"
alias cm='cl --model opus'

################################################################################
# ---- Utility Functions ----
################################################################################
# short form echo that removes leading + trailing blank lines,
# finds the first non-empty line, detects its indentation,
# and trims that indentation from all lines
function ech() {
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

function tree() {
  find . -type d | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/"
}

function pwd2() {
  echo '===== pwd ===================================='
  command pwd
  echo "cd \"$(command pwd)\""
  echo '=============================================='
}

################################################################################
# ---- Python ----
################################################################################
function activate_py() {
  type -P python &>/dev/null && return
  if [[ -z "$VIRTUAL_ENV" ]]; then
    if [[ -f "./.venv/bin/activate" ]]; then
      source ./.venv/bin/activate # uv's default (local project)
    elif [[ -f "./venv/bin/activate" ]]; then
      source ./venv/bin/activate # traditional venv (local project)
    elif [[ -f "$HOME/.venv/bin/activate" ]]; then
      source "$HOME/.venv/bin/activate" # uv's default (home directory)
    fi
  fi
}

function python() {
  activate_py
  command python "$@"
}

function pip() {
  activate_py
  command pip "$@"
}

################################################################################
# ---- Node / NPM ----
################################################################################
# wraps npm so bare subcommand names run as `npm run <name>`
function npm() {
  case "${1-}" in
    ""|-*|access|adduser|audit|bugs|cache|ci|completion|config|dedupe|deprecate|diff|dist-tag|\
    doctor|edit|exec|explain|explore|find-dupes|fund|get|help|hook|init|install|install-ci-test|\
    install-test|link|ll|login|logout|ls|org|outdated|owner|pack|ping|pkg|prefix|profile|\
    prune|publish|query|rebuild|repo|restart|root|run|run-script|search|set|shrinkwrap|\
    star|stars|start|stop|team|test|token|uninstall|unpublish|unstar|update|version|view|whoami|\
    i|t|r|rm|un|rb|c|s|se|up|ln|it|cit|ddp|la|v|x)
      command npm "$@" ;;
    *) command npm run "$@" ;;
  esac
}

function renpm() {
  rm -rf node_modules bower_components /tmp/*.cache;
  npm install
}

################################################################################
# ---- Diff (file diff or git hash compare) ----
################################################################################
function diff() {
  if [ $# -ne 2 ]; then
    command diff -w --color -y --suppress-common-lines "$@"
    return
  fi

  local file1_valid=false file2_valid=false
  [ -f "$1" ] && file1_valid=true
  [ -f "$2" ] && file2_valid=true

  # both files exist — diff them
  if $file1_valid && $file2_valid; then
    if type -P code &>/dev/null; then
      code --diff "$1" "$2"
    else
      command diff -w --color -y --suppress-common-lines "$1" "$2"
    fi
    return
  fi

  # one file exists, one doesn't
  if $file1_valid && ! $file2_valid; then
    echo "File not found: $2"
    return 1
  fi
  if ! $file1_valid && $file2_valid; then
    echo "File not found: $1"
    return 1
  fi

  # neither file exists — check if they look like git hashes
  local hash_re='^[a-f0-9]{4,40}$'
  local hash1_valid=false hash2_valid=false
  if [[ "$1" =~ $hash_re ]] && git rev-parse --verify "$1" &>/dev/null; then
    hash1_valid=true
  fi
  if [[ "$2" =~ $hash_re ]] && git rev-parse --verify "$2" &>/dev/null; then
    hash2_valid=true
  fi

  if $hash1_valid && $hash2_valid; then
    echo "git diff $1 $2"
    git diff "$1" "$2"

    # open github compare if remote is available
    local repo_url
    repo_url=$(git config --get remote.origin.url 2>/dev/null)
    if [ -n "$repo_url" ]; then
      repo_url="${repo_url#*:}"
      repo_url="${repo_url%.git}"
      repo_url="${repo_url#*github.com/}"
      local compare_url="https://github.com/${repo_url}/compare/${1}...${2}"
      echo "$compare_url"
      open "$compare_url"
    fi
    return
  fi

  # partial match — tell user which is invalid
  if ! $hash1_valid && ! $file1_valid; then
    echo "File or hash not found: $1"
  fi
  if ! $hash2_valid && ! $file2_valid; then
    echo "File or hash not found: $2"
  fi
  return 1
}

################################################################################
# ---- Git Helpers ----
################################################################################
# Resets the working tree, deletes local master/main, and re-tracks the default branch from origin
function clean_master_main_branch() {
  git stash >/dev/null 2>&1
  git clean -fd >/dev/null 2>&1
  git reset --hard HEAD >/dev/null 2>&1
  git merge --abort >/dev/null 2>&1
  git rebase --abort >/dev/null 2>&1
  git cherry-pick --abort >/dev/null 2>&1
  git am --abort >/dev/null 2>&1
  git fetch --all --prune >/dev/null 2>&1
  rm -rf .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD

  local temp_branch_name="tmp-clean-$(command date +%s)"
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

# Creates an empty commit on a new branch and pushes it to trigger a deployment
function commit_empty_trigger_deploy() {
  local temp_branch_name="empty-commit-$(command date +%s)"
  git checkout -b "$temp_branch_name" >/dev/null 2>&1
  git commit --allow-empty -m "Trigger deployment - EMPTY PR" >/dev/null 2>&1
  git push -u origin "$temp_branch_name" >/dev/null 2>&1
}

# cd to git home directory ($MY_GIT_HOME or ~/git)
function gogit(){
  local git_home="${MY_GIT_HOME:-$HOME/git}"
  cd "$git_home" 2>/dev/null || echo "gogit: $git_home is not present"
}

################################################################################
# ---- Search Functions ----
################################################################################
alias gr="grep --color -rin"   # recursive, case-insensitive, line numbers
alias gre="gr -Fw"             # gr + fixed string, whole word match

# search content in files: uses git grep in git repos (respects .gitignore), falls back to grep
# flags: -F fixed string, -w whole word, -i case-insensitive, -n line numbers
function search() {
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    git grep -Fwin "$@" # fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  else
    grep --color -rFwin "$@" . # recursive, fixed string, whole word, case-insensitive, line numbers
  fi
}

################################################################################
# ---- Filter Functions ----
################################################################################
function filter_unwanted() {
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

function filter_text_files_only() {
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
# ---- FZF Functions ----
################################################################################
# simple view file alias - will be overridden by advanced bash
function view_file() {
  vim "$@"
}

function fuzzy_paths() {
  local OUT=$(echo "$(_recent_paths)" | fzf +m --layout=reverse)
  if [ -n "$OUT" ] && [ -d "$OUT" ]; then
    echo "cd \"$OUT\""
    cd "$OUT"
  fi
}

function _fuzzy_list_all() {
  local blue=$'\033[34m'
  local reset=$'\033[0m'
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    git ls-tree -r -d --name-only HEAD 2>/dev/null | sort -u | sed "s|.*|${blue}&/${reset}|"
    git ls-files --full-name 2>/dev/null | sort -u
  else
    find . -type d 2>/dev/null | sort -u | sed "s|.*|${blue}&/${reset}|"
    find . -type f 2>/dev/null | sort -u
  fi | filter_unwanted
}

function fuzzy_open() {
  local VIEW_COMMAND="$1"
  local OUT=$(_fuzzy_list_all | fzf --ansi --layout=reverse)

  if [ -z "$OUT" ]; then
    return
  fi

  # check if selection is a directory (trailing /)
  local IS_DIR=false
  if [[ "$OUT" == */ ]]; then
    IS_DIR=true
    OUT="${OUT%/}"
  fi

  local FULL_PATH
  FULL_PATH=$(cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" && realpath "$OUT")

  echo "pwd: $(pwd)"
  echo "target: $FULL_PATH"

  if [ "$IS_DIR" = true ]; then
    open "$FULL_PATH"
  elif [ -n "$VIEW_COMMAND" ] && command -v "$VIEW_COMMAND" &>/dev/null || type "$VIEW_COMMAND" &>/dev/null; then
    "$VIEW_COMMAND" "$OUT"
  else
    view_file "$OUT"
  fi
}

################################################################################
# ---- Rainbow / Visual ----
################################################################################
rainbow_block="##########"
rainbow_colors=(91 93 92 96 94 95)

function rainbow_print() {
    local colors
    if [[ -n "$1" && "$1" =~ ^[0-9[:space:]]+$ ]]; then
        colors=($1)
        shift
    else
        colors=("${rainbow_colors[@]}")
    fi

    local input="${1:-$(cat -)}"
    local color_count=${#colors[@]}

    for (( i=0; i<${#input}; i++ )); do
        local color_idx=$(( i % color_count ))
        local color=${colors[$color_idx]}
        printf "\e[%sm%s\e[0m" "$color" "${input:$i:1}"
    done
    echo
}

# br [count] [no-clear] [reverse]
function br() {
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

    echo "$line" | rainbow_print "${colors[*]}"
}

# spinner &; SPIN_PID=$!; sleep 3; kill $SPIN_PID
function spinner() {
  local chars="/-\|"
  local colors=(91 93 92 96 94 95)
  local c_idx=0

  tput civis
  trap "tput cnorm; exit" SIGINT

  while true; do
    for (( i=0; i<${#chars}; i++ )); do
      local color="${colors[$c_idx]}"
      echo -ne $'\e[1;'"${color}m${chars:$i:1}"$'\e[m'"\r"
      sleep 0.1
      c_idx=$(( (c_idx + 1) % ${#colors[@]} ))
    done
  done
}

################################################################################
# ---- Chmod ----
################################################################################
function chmod() {
  if [ $# -eq 0 ]; then
    ech """
      chmod cheat sheet:
        chmod +x file        # add execute for everyone
        chmod u+x file       # add execute for owner
        chmod g+w file       # add write for group
        chmod o-r file       # remove read for others
        chmod u+rwx file     # owner: read + write + execute
        chmod go-wx file     # group & others: remove write + execute
        chmod a+r file       # all: add read
        chmod u+x,g+r,o-w file

        Who:   u (user/owner), g (group), o (others), a (all)
        What:  + (add), - (remove), = (set exactly / replaces)
        Perms: r (read), w (write), x (execute)
    """
  else
    command chmod "$@"
  fi
}

################################################################################
# ---- Date / Time ----
################################################################################
# Returns HH:MM:SS AM/PM with colored AM/PM indicator for PS1
function get_time() {
  local tz=${1:-""}
  local time_str ampm

  if [ "$tz" = "UTC" ]; then
    time_str=$(command date -u +'%I:%M:%S')
    ampm=$(command date -u +'%p')
  elif [ -n "$tz" ]; then
    time_str=$(TZ="$tz" command date +'%I:%M:%S')
    ampm=$(TZ="$tz" command date +'%p')
  else
    time_str=$(command date +'%I:%M:%S')
    ampm=$(command date +'%p')
  fi

  if [ "$ampm" = "AM" ]; then
    printf '%s\001\e[1;97m\002%s\001\e[m\002' "$time_str" "$ampm"
  else
    printf '%s\001\e[0;90m\002%s\001\e[m\002' "$time_str" "$ampm"
  fi
}

# no args: show UTC, PST, LOCAL; with args: passthrough to date
function date() {
  if [ $# -eq 0 ]; then
    echo $'\e[1;31m>> UTC\e[m'
    command date -u +'%a, %b %d, %Y  %r'

    echo $'\e[1;96m>> PST (California)\e[m'
    TZ="America/Los_Angeles" command date +'%a, %b %d, %Y  %r'

    echo $'\e[1;92m>> LOCAL\e[m'
    command date +'%a, %b %d, %Y  %r'
  else
    command date "$@"
  fi
}

################################################################################
# ---- Telemetry / Environment ----
################################################################################
export FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT="1" # opt out azure cli telemetry
export ELECTRON_ENABLE_LOGGING="0" # suppresses Electron's internal console spam for slight perf gain

################################################################################
# ---- Prompt Helpers ----
################################################################################
# shows branch name, remote (if not origin), and ahead/behind counts
# cached: refreshes on branch change, after max_age seconds, or max_calls calls
# invalidated automatically by git() wrapper on state-changing commands
_git_branch_cache=""
_git_branch_last=""
_git_branch_count=0
_git_branch_time=0
_git_branch_max_age=1200  # 20 minutes
_git_branch_max_calls=30
function _invalidate_git_cache() {
  _git_branch_cache=""
  _git_branch_last=""
}
function _parse_git_branch_fetch() {
  local branch ahead behind remote remote_name info=""
  branch=$(git symbolic-ref --short HEAD 2>/dev/null) || return
  remote=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
  if [ -n "$remote" ]; then
    remote_name="${remote%%/*}"
    [ "$remote_name" != "origin" ] && info+=" ${remote_name}/"
    ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null)
    behind=$(git rev-list --count HEAD..@{u} 2>/dev/null)
    [ "$ahead" -gt 0 ] 2>/dev/null && info+=" +${ahead}"
    [ "$behind" -gt 0 ] 2>/dev/null && info+=" -${behind}"
  fi
  echo "[${branch}${info}]"
}
function parse_git_branch() {
  type -P git &>/dev/null || return
  local branch now
  branch=$(git symbolic-ref --short HEAD 2>/dev/null) || return
  now=$(command date +%s)
  _git_branch_count=$((_git_branch_count + 1))
  # refresh on branch change, time expiry, or call count
  if [ "$branch" != "$_git_branch_last" ] || [ -z "$_git_branch_cache" ] || [ $(( now - _git_branch_time )) -ge $_git_branch_max_age ] || [ $_git_branch_count -ge $_git_branch_max_calls ]; then
    _git_branch_cache=$(_parse_git_branch_fetch)
    _git_branch_last="$branch"
    _git_branch_time=$now
    _git_branch_count=0
  fi
  echo "$_git_branch_cache"
}

# shows local IP addresses (cached, refreshes after max_age seconds or max_calls calls)
_ifconfig2_cache=""
_ifconfig2_count=0
_ifconfig2_time=0
_ifconfig2_max_age=1800   # 30 minutes
_ifconfig2_max_calls=60
function _ifconfig2_fetch() {
  hostname -I 2>/dev/null | tr ' ' '\n' | grep '\.' | grep -v '^127\.' | sort -u | paste -sd',' - \
    || command ifconfig 2>/dev/null | grep 'inet ' | awk '{print $2}' | grep -v '^127\.' | sort -u | paste -sd',' -
}
# running ifconfig manually invalidates the IP cache and shows full output
function ifconfig() {
  _ifconfig2_cache=""
  command ifconfig "$@"
}
function ifconfig2() {
  local now=$(command date +%s)
  _ifconfig2_count=$((_ifconfig2_count + 1))
  if [ -z "$_ifconfig2_cache" ] || [ $(( now - _ifconfig2_time )) -ge $_ifconfig2_max_age ] || [ $_ifconfig2_count -ge $_ifconfig2_max_calls ]; then
    _ifconfig2_cache=$(_ifconfig2_fetch)
    _ifconfig2_time=$now
    _ifconfig2_count=0
  fi
  echo "$_ifconfig2_cache"
}

# truncates deep paths, keeping last 3 parts full
function shorter_pwd_path() {
  local trim_count=3
  local current_path="${PWD/#$HOME/~}"
  IFS='/' read -r -a splits <<< "$current_path"
  result=""

  for idx in "${!splits[@]}"; do
    if [ $idx -lt $((${#splits[@]} - $trim_count)) ]; then
      result+="${splits[$idx]:0:1}/"
    else
      result+="${splits[$idx]}/"
    fi
  done

  echo "${result%/}"
}

################################################################################
# ---- Prompt ----
################################################################################
# 08:32:43PM U=04:32:43AM syle @ Sy-Omen45L 10.255.255.254,172.28.2.202
# ~/git/bashrc [master]
# >>>
export PS1="\n\
\[\e[1;92m\]\$(get_time) \
\[\e[1;93m\]U=\$(get_time \"UTC\") \
\[\e[1;94m\]\u\[\e[m\] @ \
\[\e[1;95m\]\h \
\[\e[1;93m\]\$(ifconfig2)\[\e[m\]\n\
\[\e[1;31m\]\$(shorter_pwd_path)\[\e[m\] \
\[\e[1;36m\]\$(parse_git_branch)\[\e[m\]\n\
>>> "
