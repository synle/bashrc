#!/usr/bin/env bash
################################################################################
# --- tmux Workspaces ---
# build, snapshot, and tear down named tmux sessions from a small JSON file.
#
# schema (the "simple mode" - one window per entry, no panes, no tmuxp):
#   {
#     "session": "my_project_session",
#     "folder": "~/git/my_project",
#     "windows": [
#       { "name": "shell",  "command": "git status --short --branch" },
#       { "name": "logs",   "command": "tail -f logs/app.log", "folder": "/var/log" }
#     ]
#   }
#
# folder is optional at both levels: window wins, then session, then $PWD.
# a per-project launcher is a heredoc plus one call - see docs/tmux.md:
#   function my_workspace() {
#     local config="${TMPDIR:-/tmp}/my_workspace.json"
#     command cat > "$config" << 'JSON_EOF'
#   { "session": "my_project_session",
#     "windows": [ { "name": "Build the App", "command": "build_project" } ] }
#   JSON_EOF
#     workspace_create "$config" "$@"
#   }
#
# jq does the parsing (installed by every _full-setup.sh); tmuxp is NOT required.
# docs/tmux.md carries the reasoning, the tmuxp comparison, and the pane-capable
# variants that did not make the cut here.
#
# --- Temp workspaces ---
# For a single throwaway command that should outlive the shell that started it,
# skip the config entirely - workspace_temp_create is a thin alias into tmux
# against one hardcoded session name ($WORKSPACE_TEMP_SESSION):
#   workspace_temp_create --force --detach long_running_job
#   workspace_temp_open      # watch it
#   workspace_temp_close     # kill every temp session
################################################################################

WORKSPACE_CONFIG_FOLDER="$HOME/.config/workspaces"

## every workspace_temp_* helper shares ONE hardcoded session name, so a
## throwaway job always lands in the same place and `workspace_temp_open` needs
## no argument. Also the PREFIX workspace_temp_close matches on, so a suffixed
## variant would still be reaped.
WORKSPACE_TEMP_SESSION="workspace_temp"

# attach from outside tmux, switch from inside it (attach errors when $TMUX is set)
function _workspace_attach() {
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "=$1"
  else
    tmux attach-session -t "=$1"
  fi
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
  Usage: workspace_create <name|path.json> [--force]
  When the session already exists you are asked whether to kill and rebuild it;
  answering no (the default) attaches to the running session instead.
  Flags:
    --force    kill the existing session and rebuild it, skipping the prompt
  Lookup order for <name>:
    <name>  <name>.json  \$PWD/<name>.json  $WORKSPACE_CONFIG_FOLDER/<name>.json
  Examples:
    workspace_create my_project.json
    workspace_create my_project --force
    workspace_sample_json && workspace_create \$(ls -t *.json | head -1)"
    return 1
  fi

  _workspace_require || return 1

  local config_file="" force=false arg
  for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
      force=true
    elif [ -z "$config_file" ]; then
      config_file="$arg"
    fi
  done

  local found
  found=$(_workspace_resolve_config "$config_file")
  if [ -z "$found" ]; then
    echo "workspace_create: config not found: ${config_file:-<none>}" >&2
    return 1
  fi
  config_file="$found"

  if ! jq -e . "$config_file" > /dev/null 2>&1; then
    echo "workspace_create: invalid JSON: $config_file" >&2
    return 1
  fi

  local session
  session=$(jq -r '.session // .session_name // empty' "$config_file")
  if [ -z "$session" ]; then
    echo "workspace_create: config has no .session" >&2
    return 1
  fi

  ## existing session: --force rebuilds outright, otherwise ask. prompt_yes_no
  ## defaults to no and answers no without a tty, so the unattended path and a
  ## bare Enter both keep today's behavior: attach to what is already running.
  ## "=" forces an exact match - without it "api" also matches "api_staging"
  if tmux has-session -t "=$session" 2> /dev/null; then
    if [ "$force" = "true" ] || prompt_yes_no "workspace_create: session '$session' already exists. Kill it and rebuild?"; then
      tmux kill-session -t "=$session"
    else
      _workspace_attach "$session"
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
      tmux new-session -d -s "$session" -n "$name" -c "$folder" ${quoted:+"$quoted"} || return 1
    else
      tmux new-window -t "=$session:" -n "$name" -c "$folder" ${quoted:+"$quoted"} || return 1
    fi
    index=$((index + 1))
  done < <(jq -r '.windows[]? | [(.name // .window_name // ""), (.command // ""), (.folder // .start_directory // "")] | @tsv' "$config_file")

  if [ "$index" -eq 0 ]; then
    echo "workspace_create: no windows defined in $config_file" >&2
    return 1
  fi

  tmux select-window -t "=$session:" > /dev/null 2>&1
  _workspace_attach "$session"
}

# write a sample config named <datetime>.json, session name carrying the same stamp
function workspace_sample_json() {
  if is_help_arg "${1:-}"; then
    echo "workspace_sample_json: write a starter workspace config named <datetime>.json
  Usage: workspace_sample_json [folder|file] [--stdout]
  Flags:
    --stdout   print the config instead of writing it
  Examples:
    workspace_sample_json
    workspace_sample_json $WORKSPACE_CONFIG_FOLDER
    workspace_create \"\$(workspace_sample_json)\""
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

  if [ "$to_stdout" = "true" ]; then
    printf '%s\n' "$json"
    return 0
  fi

  [ -n "$target" ] || target="$PWD"
  if [ -d "$target" ]; then
    target="$target/$stamp.json"
  fi
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
    with no output file, prints to stdout
    tmux only reports the running process NAME, so 'tail -f app.log' freezes as
    'tail' - fill the arguments back in by hand
  Examples:
    workspace_freeze my_active_session my_project.json
    workspace_freeze my_active_session
    workspace_freeze"
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

  if [ -e "$out" ] && [ "$force" != "true" ]; then
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
    workspace_open my_project_session
    workspace_open"
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
    workspace_close my_project_session"
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
    workspace_close_all
    workspace_close_all --force"
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
  if [ "$force" != "true" ]; then
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
    workspace_list"
    return 1
  fi

  tmux list-sessions -F '#{session_name}	#{session_windows} windows	#{?session_attached,attached,detached}' 2> /dev/null \
    || echo "workspace_list: no tmux sessions running"
}

# --- Temp workspaces ---
# The no-JSON path: park one throwaway command in a tmux session so it survives
# the shell that launched it. No config file, no schema - straight to tmux.
# Everything shares $WORKSPACE_TEMP_SESSION, so nothing has to name a session.

# run one command in the shared temp session, building the session if needed
function workspace_temp_create() {
  if is_help_arg "${1:-}"; then
    echo "workspace_temp_create: run a command in the shared temp tmux session
  Usage: workspace_temp_create [--force] [--detach] <command...>
  The session is always '$WORKSPACE_TEMP_SESSION' - no config file, no session
  name to pick. When it already exists you are asked whether to kill and
  rebuild it; answering no (the default) attaches to the running session and
  leaves the command unrun.
  Flags:
    --force    kill the existing session and rebuild it, skipping the prompt
    --detach   build the session and return instead of attaching, for scripts
  Examples:
    workspace_temp_create htop
    workspace_temp_create --force 'make validate'
    workspace_temp_create --force --detach long_running_job"
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
  if tmux has-session -t "=$WORKSPACE_TEMP_SESSION" 2> /dev/null; then
    if [ "$force" = "true" ] || prompt_yes_no "workspace_temp_create: session '$WORKSPACE_TEMP_SESSION' already exists. Kill it and rebuild?"; then
      tmux kill-session -t "=$WORKSPACE_TEMP_SESSION"
    else
      _workspace_attach "$WORKSPACE_TEMP_SESSION"
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
  tmux new-session -d -s "$WORKSPACE_TEMP_SESSION" -n "$window" -c "$PWD" "bash -ic $quoted" || return 1

  if [ "$detach" = "true" ]; then
    echo "workspace_temp_create: running '$cmd' in '$WORKSPACE_TEMP_SESSION' (detached; workspace_temp_open to watch)"
    return 0
  fi
  _workspace_attach "$WORKSPACE_TEMP_SESSION"
}

# attach to the shared temp session
function workspace_temp_open() {
  if is_help_arg "${1:-}"; then
    echo "workspace_temp_open: attach to the shared temp tmux session
  Usage: workspace_temp_open
  Thin wrapper over workspace_open pinned to '$WORKSPACE_TEMP_SESSION'.
  Never builds anything - use workspace_temp_create for that.
  Examples:
    workspace_temp_open"
    return 1
  fi

  workspace_open "$WORKSPACE_TEMP_SESSION"
}

# kill every temp session
function workspace_temp_close() {
  if is_help_arg "${1:-}"; then
    echo "workspace_temp_close: kill every temp tmux session
  Usage: workspace_temp_close
  Matches '$WORKSPACE_TEMP_SESSION' and anything prefixed with it. Temp
  sessions are disposable by definition, so there is no prompt - every process
  inside them dies. Use workspace_close_all for non-temp sessions.
  Examples:
    workspace_temp_close"
    return 1
  fi

  _workspace_require || return 1

  local sessions
  sessions=$(tmux list-sessions -F '#{session_name}' 2> /dev/null | command grep "^$WORKSPACE_TEMP_SESSION")
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
alias ws="workspace_create"
alias wso="workspace_open"
alias wsls="workspace_list"
alias wsf="workspace_freeze"
alias wsn="workspace_sample_json"
alias wsx="workspace_close"
alias wsxa="workspace_close_all"
alias wst="workspace_temp_create"
alias wsto="workspace_temp_open"
alias wstx="workspace_temp_close"
