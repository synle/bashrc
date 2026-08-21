#!/usr/bin/env bash
################################################################################
# --- tmux Workspaces ---
# build, snapshot, and tear down named tmux sessions from a small JSON file.
#
# schema (the "simple mode" - one window per entry, no panes, no tmuxp):
#   {
#     "session": "my_project_session",
#     "folder": "~/git/my_project",
#     "active_window": 2,
#     "windows": [
#       { "name": "shell",  "command": "git status --short --branch" },
#       { "name": "logs",   "command": "tail -f logs/app.log", "folder": "/var/log" }
#     ]
#   }
#
# folder is optional at both levels: window wins, then session, then $PWD.
# the selected window follows tmuxp: a window carrying "focus": true wins, else
# the 1-based "active_window" at the top, else the first window.
# a per-project launcher is a heredoc plus one call - see docs/tmux.md. Either
# spool the config to a file, or hand it to workspace_create on stdin with "-":
#   function my_workspace() {
#     ## option 1 - config on disk
#     local config="${TMPDIR:-/tmp}/my_workspace.json"
#     command cat > "$config" << 'JSON_EOF'
#   { "session": "my_project_session",
#     "windows": [ { "name": "Build the App", "command": "build_project" } ] }
#   JSON_EOF
#     workspace_create "$config" "$@"
#   }
#
#   function my_workspace_no_temp_file() {
#     ## option 2 - same thing, straight down stdin, nothing written anywhere
#     workspace_create - "$@" << 'JSON_EOF'
#   { "session": "my_project_session",
#     "active_window": 1,
#     "windows": [ { "name": "Build the App", "command": "build_project" } ] }
#   JSON_EOF
#   }
#
# jq does the parsing (installed by every _full-setup.sh); tmuxp is NOT required.
# docs/tmux.md carries the reasoning, the tmuxp comparison, and the pane-capable
# variants that did not make the cut here.
#
# --- Temp workspaces ---
# For a single throwaway command that should outlive the shell that started it,
# skip the config entirely - workspace_temp_create is a thin alias into tmux
# against one hardcoded session name ($_WORKSPACE_TEMP_SESSION):
#   workspace_temp_create --force --detach long_running_job
#   workspace_temp_open      # watch it
#   workspace_temp_close     # kill every temp session
################################################################################

## $SY_ROOT_FOLDER comes from common-env.sh, the single place the personal root
## is named, and run.sh re-exports it into ~/.bash_syle_common so every shell
## that sources this partial already has it. Read it DIRECTLY — no `:-` default
## here, because a per-consumer default is a second declaration that silently
## disagrees with the real one the day the root moves. If it is empty, the env
## is broken and an obviously-wrong path is the correct, visible outcome.
WORKSPACE_CONFIG_FOLDER="${SY_ROOT_FOLDER}/workspaces_tmux"

## every workspace_temp_* helper shares ONE hardcoded session name, so a
## throwaway job always lands in the same place and `workspace_temp_open` needs
## no argument. Also the PREFIX workspace_temp_close matches on, so a suffixed
## variant would still be reaped.
## underscore-prefixed and personally namespaced on purpose: this is internal,
## and a bare name like "workspace_temp" is common enough to collide with a
## session someone else (or another tool) created.
_WORKSPACE_TEMP_SESSION="syle_temp_workspace"

# attach from outside tmux, switch from inside it (attach errors when $TMUX is set)
function _workspace_attach() {
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "=$1"
  else
    tmux attach-session -t "=$1"
  fi
}

# _workspace_attach, unless the caller passed --detach. $1 = the detach flag,
# $2 = the session. Attaching blocks a script until a human detaches, so every
# public builder ends here rather than calling _workspace_attach directly.
function _workspace_attach_unless_detached() {
  if is_truthy "$1"; then
    echo "workspace: '$2' left running detached - workspace_open $2 to attach"
    return 0
  fi
  _workspace_attach "$2"
}

# guard: jq present, tmux present
function _workspace_require() {
  if ! type -P tmux > /dev/null 2>&1; then
    echo "workspace: tmux is not installed" >&2
    return 1
  fi
  if ! type -P jq > /dev/null 2>&1; then
    echo "workspace: jq is required to read the config" >&2
    return 1
  fi
}

# resolve a bare name to a config file, echoing the path it settled on
function _workspace_resolve_config() {
  local name="$1" candidate
  [ -n "$name" ] || return 1
  for candidate in \
    "$name" \
    "$name.json" \
    "$PWD/$name.json" \
    "$WORKSPACE_CONFIG_FOLDER/$name.json"; do
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# build a tmux session from a JSON config, or attach when it already exists
function workspace_create() {
  if is_help_arg "${1:-}"; then
    echo "workspace_create: build or attach a tmux session described by a JSON file
  Usage: workspace_create <name|path.json|-> [--force] [--detach]
  When the session already exists you are asked whether to kill and rebuild it;
  answering no (the default) attaches to the running session instead.
  Reading '-' takes the config on stdin, so a launcher needs no temp file.
  Selected window: a window with \"focus\": true (tmuxp's spelling) wins,
  otherwise the 1-based \"active_window\" at the top level, otherwise the first
  window. An out-of-range or non-numeric value falls back to the first.
  Flags:
    --force    kill the existing session and rebuild it, skipping the prompt
    --detach   build the session and return instead of attaching, for scripts
  Lookup order for <name>:
    <name>  <name>.json  \$PWD/<name>.json  $WORKSPACE_CONFIG_FOLDER/<name>.json
  Examples:
    workspace_create my_project.json                # build from ./my_project.json, then attach
    workspace_create my_project                     # same file, found via the lookup order above
    workspace_create my_project --force             # kill the running session and rebuild, no prompt
    workspace_create my_project --force --detach    # rebuild but stay in this shell - the script form
    workspace_create - --force < my_project.json    # config on stdin, no file lookup at all
    workspace_sample_json && workspace_create \$(ls -t *.json | head -1)   # scaffold, then build it"
    return 1
  fi

  _workspace_require || return 1

  local config_file="" force=false detach=false arg
  for arg in "$@"; do
    case "$arg" in
    --force) force=true ;;
    --detach) detach=true ;;
    *) [ -n "$config_file" ] || config_file="$arg" ;;
    esac
  done

  ## "-" reads the config from stdin, so a launcher can pipe a heredoc straight
  ## in and never own a temp file. jq is asked for several fields at different
  ## points, and stdin can only be read once, so it is spooled to a temp file
  ## here and removed on every exit path below.
  local tmp_config=""
  if [ "$config_file" = "-" ]; then
    tmp_config=$(mktemp "${TMPDIR:-/tmp}/workspace_stdin.XXXXXX") || return 1
    command cat > "$tmp_config"
    config_file="$tmp_config"
  else
    local found
    found=$(_workspace_resolve_config "$config_file")
    if [ -z "$found" ]; then
      echo "workspace_create: config not found: ${config_file:-<none>}" >&2
      return 1
    fi
    config_file="$found"
  fi

  if ! jq -e . "$config_file" > /dev/null 2>&1; then
    echo "workspace_create: invalid JSON: ${tmp_config:-$config_file}" >&2
    [ -z "$tmp_config" ] || command rm -f "$tmp_config"
    return 1
  fi

  local session
  session=$(jq -r '.session // .session_name // empty' "$config_file")
  if [ -z "$session" ]; then
    echo "workspace_create: config has no .session" >&2
    [ -z "$tmp_config" ] || command rm -f "$tmp_config"
    return 1
  fi

  ## existing session: --force rebuilds outright, otherwise ask. prompt_yes_no
  ## defaults to no and answers no without a tty, so the unattended path and a
  ## bare Enter both keep today's behavior: attach to what is already running.
  ## "=" forces an exact match - without it "api" also matches "api_staging"
  if tmux has-session -t "=$session" 2> /dev/null; then
    if is_truthy "$force" || prompt_yes_no "workspace_create: session '$session' already exists. Kill it and rebuild?"; then
      tmux kill-session -t "=$session"
    else
      [ -z "$tmp_config" ] || command rm -f "$tmp_config"
      _workspace_attach_unless_detached "$detach" "$session"
      return $?
    fi
  fi

  local root
  root=$(jq -r '.folder // .start_directory // empty' "$config_file")
  root=${root/#\~/$HOME}

  local index=0 name cmd folder quoted
  while IFS=$'\t' read -r name cmd folder; do
    [ -n "$name" ] || name="win$index"
    folder=${folder/#\~/$HOME}
    [ -n "$folder" ] || folder="$root"
    [ -n "$folder" ] || folder="$PWD"

    ## printf %q keeps quotes/apostrophes in the command intact - tmux hands the
    ## string to sh, so an unescaped "it's" would end the quoting early
    if [ -n "$cmd" ]; then
      quoted=$(printf '%q' "$cmd; exec bash")
      quoted="bash -ic $quoted"
    else
      quoted=""
    fi

    if [ "$index" -eq 0 ]; then
      tmux new-session -d -s "$session" -n "$name" -c "$folder" ${quoted:+"$quoted"} || {
        [ -z "$tmp_config" ] || command rm -f "$tmp_config"
        return 1
      }
    else
      tmux new-window -t "=$session:" -n "$name" -c "$folder" ${quoted:+"$quoted"} || {
        [ -z "$tmp_config" ] || command rm -f "$tmp_config"
        return 1
      }
    fi
    index=$((index + 1))
  done < <(jq -r '.windows[]? | [(.name // .window_name // ""), (.command // ""), (.folder // .start_directory // "")] | @tsv' "$config_file")

  if [ "$index" -eq 0 ]; then
    echo "workspace_create: no windows defined in $config_file" >&2
    [ -z "$tmp_config" ] || command rm -f "$tmp_config"
    return 1
  fi

  ## which window ends up selected. tmuxp marks it per window with `focus: true`,
  ## so that spelling wins; `active_window` is the same thing as a 1-based
  ## position for configs that would rather say it once at the top. Default is 1
  ## (the first window) - without an explicit select, tmux leaves the LAST window
  ## created active, which is never what a launcher wants.
  local focus_index
  focus_index=$(jq -r '
      ( [ (.windows // []) | to_entries[]
          | select((.value.focus // false) | tostring == "true")
          | .key + 1 ][0]
        // .active_window // .focus_window // 1 )' "$config_file")
  [ -z "$tmp_config" ] || command rm -f "$tmp_config"

  ## bounds-check rather than trust the config: a non-number, a 0, or an index
  ## past the last window falls back to the first window instead of failing the
  ## build of an otherwise-good session
  case "$focus_index" in
  '' | *[!0-9]*) focus_index=1 ;;
  esac
  if [ "$focus_index" -lt 1 ] || [ "$focus_index" -gt "$index" ]; then
    focus_index=1
  fi

  ## select by window ID read back from tmux, not by "$session:$n" - the index a
  ## window gets depends on the base-index option, which this config knows
  ## nothing about (tmux.config sets it to 1)
  local target_window
  target_window=$(tmux list-windows -t "=$session" -F '#{window_id}' 2> /dev/null | sed -n "${focus_index}p")
  [ -n "$target_window" ] && tmux select-window -t "$target_window" > /dev/null 2>&1

  _workspace_attach_unless_detached "$detach" "$session"
}

# write a sample config named <datetime>.json, session name carrying the same stamp
function workspace_sample_json() {
  if is_help_arg "${1:-}"; then
    echo "workspace_sample_json: write a starter workspace config named <datetime>.json
  Usage: workspace_sample_json [folder|file] [--stdout]
  Flags:
    --stdout   print the config instead of writing it
  Notes:
    writes into \$PWD unless given a folder, and prints the path it wrote so the
    result can be piped straight into workspace_create
  Examples:
    workspace_sample_json                            # writes \$PWD/<datetime>.json, prints that path
    workspace_sample_json $WORKSPACE_CONFIG_FOLDER   # writes <datetime>.json into that folder instead
    workspace_sample_json my_project.json            # writes exactly that filename
    workspace_sample_json --stdout                   # prints the config, writes nothing
    workspace_create \"\$(workspace_sample_json)\"       # scaffold a config and build it in one go"
    return 1
  fi

  local stamp target="" arg to_stdout=false
  for arg in "$@"; do
    if [ "$arg" = "--stdout" ]; then
      to_stdout=true
    elif [ -z "$target" ]; then
      target="$arg"
    fi
  done

  ## one stamp for both names - calling date twice can straddle a second
  stamp=$(date +%Y-%m-%d_%H-%M-%S)

  ## commands are deliberately boring and always present: a sample that assumes
  ## an editor or package manager fails on the machine you are trying it on
  local json
  json=$(
    command cat << JSON_EOF
{
  "session": "my_project_session_$stamp",
  "folder": "$PWD",
  "windows": [
    { "name": "shell", "command": "git status --short --branch" },
    { "name": "monitor", "command": "top" },
    { "name": "logs", "command": "git log --oneline --graph --decorate -20" }
  ]
}
JSON_EOF
  )

  if is_truthy "$to_stdout"; then
    printf '%s\n' "$json"
    return 0
  fi

  [ -n "$target" ] || target="$PWD"
  ## anything not ending in .json is a folder, existing or not - create it and
  ## name the file inside. Without this, `workspace_sample_json
  ## $WORKSPACE_CONFIG_FOLDER` on a fresh machine writes a FILE at that path and
  ## quietly breaks every later lookup.
  case "$target" in
  *.json) ;;
  *)
    safe_mkdir "$target" || return 1
    target="$target/$stamp.json"
    ;;
  esac
  printf '%s\n' "$json" > "$target" || return 1
  echo "$target"
}

# snapshot a live session back into a config - the cheap knockoff of `tmuxp freeze`
function workspace_freeze() {
  if is_help_arg "${1:-}"; then
    echo "workspace_freeze: snapshot a running tmux session into a workspace JSON config
  Usage: workspace_freeze [session] [output.json] [--force]
  Flags:
    --force    overwrite an existing output file
  Notes:
    with no session, freezes the session you are currently in
    with no output file, prints to stdout - nothing is written anywhere
    with an output file, writes it relative to \$PWD and prints the path it wrote
    tmux only reports the running process NAME, so 'tail -f app.log' freezes as
    'tail' - fill the arguments back in by hand
  Examples:
    workspace_freeze                                     # current session -> stdout, writes nothing
    workspace_freeze my_active_session                   # that session   -> stdout, writes nothing
    workspace_freeze my_active_session my_project.json   # writes \$PWD/my_project.json, prints that path
    workspace_freeze my_active_session my_project.json --force   # same, overwriting the existing file
    workspace_freeze my_active_session $WORKSPACE_CONFIG_FOLDER/my_project.json   # park it where
                                                         # workspace_create's <name> lookup finds it
    workspace_create \"\$(workspace_freeze my_active_session my_project.json)\"   # freeze, then rebuild"
    return 1
  fi

  _workspace_require || return 1

  local session="" out="" force=false arg
  for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
      force=true
    elif [ -z "$session" ]; then
      session="$arg"
    elif [ -z "$out" ]; then
      out="$arg"
    fi
  done

  [ -n "$session" ] || session=$(tmux display-message -p '#{session_name}' 2> /dev/null)
  if [ -z "$session" ]; then
    echo "workspace_freeze: no session given and not inside tmux" >&2
    return 1
  fi
  if ! tmux has-session -t "=$session" 2> /dev/null; then
    echo "workspace_freeze: no such session: $session" >&2
    return 1
  fi

  ## one tmux call for the whole session; jq builds the JSON so a window named
  ## `weird "name"` cannot produce an unparseable file
  local json
  json=$(tmux list-windows -t "=$session" -F '#{window_name}	#{pane_current_path}	#{pane_current_command}' \
    | jq -R -s --arg session "$session" '
        [ split("\n")[] | select(length > 0) | split("\t")
          | { name: .[0], folder: .[1], command: .[2] } ]
        | { session: $session,
            windows: [ .[] | {
              name: .name,
              command: (if (.command | test("^(bash|zsh|sh|fish)$")) then "" else .command end),
              folder: .folder
            } | with_entries(select(.value != "")) ] }')

  if [ -z "$json" ]; then
    echo "workspace_freeze: captured nothing from $session" >&2
    return 1
  fi

  if [ -z "$out" ]; then
    printf '%s\n' "$json"
    return 0
  fi

  if [ -e "$out" ] && ! is_truthy "$force"; then
    echo "workspace_freeze: $out exists (pass --force to overwrite)" >&2
    return 1
  fi
  printf '%s\n' "$json" > "$out" || return 1
  echo "$out"
}

# attach to an already-running session by exact name, or pick one from a list
function workspace_open() {
  if is_help_arg "${1:-}"; then
    echo "workspace_open: attach to a tmux session that is already running
  Usage: workspace_open [session]
  Never builds anything - use workspace_create to build a session from JSON.
  With no name, or when the name does not exist, the running sessions are
  listed and you pick one by number (just Enter aborts).
  Examples:
    workspace_open my_project_session   # attach to it (switch-client if already inside tmux)
    workspace_open                      # list what is running and pick one by number"
    return 1
  fi

  _workspace_require || return 1

  local session="${1:-}"
  ## "=" forces an exact match - without it "api" also attaches to "api_staging"
  if [ -n "$session" ] && tmux has-session -t "=$session" 2> /dev/null; then
    _workspace_attach "$session"
    return $?
  fi
  if [ -n "$session" ]; then
    echo "workspace_open: no such session: $session" >&2
  fi

  local sessions
  sessions=$(tmux list-sessions -F '#{session_name}' 2> /dev/null)
  if [ -z "$sessions" ]; then
    echo "workspace_open: no tmux sessions running" >&2
    return 1
  fi

  ## the caller named nothing usable, so show what exists and let them choose.
  ## PS3/select needs a terminal; without one just print the list and fail.
  if [ ! -t 0 ]; then
    echo "workspace_open: available sessions:" >&2
    echo "$sessions" | sed 's/^/  /' >&2
    return 1
  fi

  local choice="" old_ps3="${PS3:-}"
  echo "workspace_open: available sessions:" >&2
  PS3="Open which session? (Enter to abort) "
  select choice in $sessions; do
    break
  done
  PS3="$old_ps3"

  if [ -z "$choice" ]; then
    echo "workspace_open: aborted" >&2
    return 1
  fi
  _workspace_attach "$choice"
}

# kill one session by exact name
function workspace_close() {
  if is_help_arg "${1:-}"; then
    echo "workspace_close: kill a single tmux session by exact name
  Usage: workspace_close <session>
  Examples:
    workspace_close my_project_session   # kills exactly that name, never a prefix match"
    return 1
  fi

  local session="$1"
  if [ -z "$session" ]; then
    echo "workspace_close: usage: workspace_close <session>" >&2
    return 1
  fi
  if ! tmux has-session -t "=$session" 2> /dev/null; then
    echo "workspace_close: no such session: $session" >&2
    return 1
  fi
  tmux kill-session -t "=$session" && echo "workspace_close: killed $session"
}

# kill every session, after showing what is about to die
function workspace_close_all() {
  if is_help_arg "${1:-}"; then
    echo "workspace_close_all: kill EVERY tmux session on this machine
  Usage: workspace_close_all [--force]
  Flags:
    --force    skip the confirmation prompt (-y also works)
  Warning:
    every process in every session dies and cannot be recovered - unsaved editor
    buffers, running builds, other people's agent sessions included
  Examples:
    workspace_close_all           # prints the list and the count, then asks y/N
    workspace_close_all --force   # kills everything with no prompt - scripts only"
    return 1
  fi

  local force=false
  if [ "${1:-}" = "--force" ] || [ "${1:-}" = "-y" ]; then
    force=true
  fi

  local sessions
  sessions=$(tmux list-sessions -F '#{session_name}' 2> /dev/null)
  if [ -z "$sessions" ]; then
    echo "workspace_close_all: no tmux sessions running"
    return 0
  fi

  ## destructive and unrecoverable - always show the list before asking
  echo "workspace_close_all: about to kill $(echo "$sessions" | wc -l | tr -d ' ') session(s):"
  echo "$sessions" | sed 's/^/  /'
  if ! is_truthy "$force"; then
    local reply=""
    printf 'Kill all of them? [y/N] '
    read -r reply
    case "$reply" in
    [yY] | [yY][eE][sS]) ;;
    *)
      echo "workspace_close_all: aborted"
      return 1
      ;;
    esac
  fi

  ## list captured before the loop, so a session started mid-teardown survives
  echo "$sessions" | while IFS= read -r s; do
    [ -n "$s" ] || continue
    tmux kill-session -t "=$s" 2> /dev/null && echo "workspace_close_all: killed $s"
  done
  return 0
}

# list running sessions with their window counts
function workspace_list() {
  if is_help_arg "${1:-}"; then
    echo "workspace_list: list running tmux sessions and their window counts
  Usage: workspace_list
  Examples:
    workspace_list   # one line per session: name, window count, attached/detached"
    return 1
  fi

  tmux list-sessions -F '#{session_name}	#{session_windows} windows	#{?session_attached,attached,detached}' 2> /dev/null \
    || echo "workspace_list: no tmux sessions running"
}

################################################################################
# --- Temp workspaces ---
################################################################################
# The no-JSON path: park one throwaway command in a tmux session so it survives
# the shell that launched it. No config file, no schema - straight to tmux.
# Everything shares $_WORKSPACE_TEMP_SESSION, so nothing has to name a session.
################################################################################

# run one command in the shared temp session, building the session if needed
function workspace_temp_create() {
  if is_help_arg "${1:-}"; then
    echo "workspace_temp_create: run a command in the shared temp tmux session
  Usage: workspace_temp_create [--force] [--detach] <command...>
  The session is always '$_WORKSPACE_TEMP_SESSION' - no config file, no session
  name to pick. When it already exists you are asked whether to kill and
  rebuild it; answering no (the default) attaches to the running session and
  leaves the command unrun.
  Flags:
    --force    kill the existing session and rebuild it, skipping the prompt
    --detach   build the session and return instead of attaching, for scripts
  Examples:
    workspace_temp_create htop                               # run htop in the temp session, attach
    workspace_temp_create --force 'make validate'            # rebuild without asking, then attach
    workspace_temp_create --force --detach long_running_job  # park it and return - the script form"
    return 1
  fi

  _workspace_require || return 1

  local force=false detach=false arg
  local cmd_parts=()
  for arg in "$@"; do
    case "$arg" in
    --force) force=true ;;
    --detach) detach=true ;;
    *) cmd_parts+=("$arg") ;;
    esac
  done

  local cmd="${cmd_parts[*]}"
  if [ -z "$cmd" ]; then
    echo "workspace_temp_create: no command given (see --help)" >&2
    return 1
  fi

  ## same policy as workspace_create: --force rebuilds outright, otherwise ask,
  ## and a no (also the unattended default) attaches to what is already running
  ## rather than killing someone's job. "=" forces an exact name match.
  if tmux has-session -t "=$_WORKSPACE_TEMP_SESSION" 2> /dev/null; then
    if is_truthy "$force" || prompt_yes_no "workspace_temp_create: session '$_WORKSPACE_TEMP_SESSION' already exists. Kill it and rebuild?"; then
      tmux kill-session -t "=$_WORKSPACE_TEMP_SESSION"
    else
      _workspace_attach_unless_detached "$detach" "$_WORKSPACE_TEMP_SESSION"
      return $?
    fi
  fi

  ## window carries the command's first word, so `workspace_list` reads usefully
  local window="${cmd_parts[0]##*/}"

  ## printf %q keeps quotes/apostrophes intact - tmux hands the string to sh.
  ## `exec bash` holds the window open after the command exits so output stays
  ## readable, matching workspace_create.
  local quoted
  quoted=$(printf '%q' "$cmd; exec bash")
  tmux new-session -d -s "$_WORKSPACE_TEMP_SESSION" -n "$window" -c "$PWD" "bash -ic $quoted" || return 1

  _workspace_attach_unless_detached "$detach" "$_WORKSPACE_TEMP_SESSION"
}

# attach to the shared temp session
function workspace_temp_open() {
  if is_help_arg "${1:-}"; then
    echo "workspace_temp_open: attach to the shared temp tmux session
  Usage: workspace_temp_open
  Thin wrapper over workspace_open pinned to '$_WORKSPACE_TEMP_SESSION'.
  Never builds anything - use workspace_temp_create for that.
  Examples:
    workspace_temp_open   # attach to '$_WORKSPACE_TEMP_SESSION', or say it is not running"
    return 1
  fi

  workspace_open "$_WORKSPACE_TEMP_SESSION"
}

# kill every temp session
function workspace_temp_close() {
  if is_help_arg "${1:-}"; then
    echo "workspace_temp_close: kill every temp tmux session
  Usage: workspace_temp_close
  Matches '$_WORKSPACE_TEMP_SESSION' and anything prefixed with it. Temp
  sessions are disposable by definition, so there is no prompt - every process
  inside them dies. Use workspace_close_all for non-temp sessions.
  Examples:
    workspace_temp_close   # kills '$_WORKSPACE_TEMP_SESSION' and anything prefixed with it"
    return 1
  fi

  _workspace_require || return 1

  local sessions
  sessions=$(tmux list-sessions -F '#{session_name}' 2> /dev/null | command grep "^$_WORKSPACE_TEMP_SESSION")
  if [ -z "$sessions" ]; then
    echo "workspace_temp_close: no temp sessions running"
    return 0
  fi

  ## list captured before the loop, so a session started mid-teardown survives
  echo "$sessions" | while IFS= read -r s; do
    [ -n "$s" ] || continue
    tmux kill-session -t "=$s" 2> /dev/null && echo "workspace_temp_close: killed $s"
  done
  return 0
}

# --- Aliases ---
## first letter of each word after "workspace", with two carve-outs:
##   ws / wst   bare prefix = create, the primary verb - so wsc is free for close
##              (create and close both start with c; nothing else collides)
##   wsls       workspace_list, NOT wsl - `wsl` is the Windows Subsystem for
##              Linux launcher and is on PATH under MinGW / Git Bash
alias ws="workspace_create"
alias wso="workspace_open"
alias wsls="workspace_list"
alias wsf="workspace_freeze"
alias wssj="workspace_sample_json"
alias wsc="workspace_close"
alias wsca="workspace_close_all"
alias wst="workspace_temp_create"
alias wsto="workspace_temp_open"
alias wstc="workspace_temp_close"
