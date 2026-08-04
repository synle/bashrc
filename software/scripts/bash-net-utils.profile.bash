#!/usr/bin/env bash
################################################################################
# --- Network Utilities ---
################################################################################

# _expand_port_args: expand a list of port args (single ports and ranges) into individual ports
function _expand_port_args() {
  local arg
  for arg in "$@"; do
    if [[ "$arg" =~ ^([0-9]+)-([0-9]+)$ ]]; then
      local start="${BASH_REMATCH[1]}"
      local end="${BASH_REMATCH[2]}"
      if [ "$start" -gt "$end" ]; then
        echo ">> Invalid range: $arg (start > end)" >&2
        return 1
      fi
      seq "$start" "$end"
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
      echo "$arg"
    else
      echo ">> Invalid port: $arg (must be a number or range like 3000-4000)" >&2
      return 1
    fi
  done
}

# list_ports: list processes listening on the given ports
function list_ports() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "list_ports: list processes listening on the given TCP ports
  Usage: list_ports <port|range> [port|range ...]
  Examples:
    list_ports 3000
    list_ports 3000 3001 4000
    list_ports 3000-3010
    list_ports 80 3000-3005 8080"
    return 0
  fi

  local ports
  ports="$(_expand_port_args "$@")" || return 1

  local port found=0
  while IFS= read -r port; do
    local pids
    pids=$(_find_pid_by_port "$port")
    if [ -n "$pids" ]; then
      echo "Port $port is in use (PID(s): $(echo "$pids" | tr '\n' ' ')):"
      if type -P lsof &> /dev/null; then
        lsof -i tcp:"$port" -sTCP:LISTEN 2> /dev/null
      else
        ps -p "$(echo "$pids" | tr '\n' ',')" -o pid,comm 2> /dev/null
      fi
      echo ""
      found=1
    fi
  done <<< "$ports"

  if ! ((found)); then
    echo ">> No processes found on the given ports."
  fi
}

# kill_port: kill the process listening on a single port
# _find_pid_by_port <port> - Find PID(s) listening on a TCP port (lsof or ss)
function _find_pid_by_port() {
  local port="$1"
  if type -P lsof &> /dev/null; then
    lsof -ti tcp:"$port" -sTCP:LISTEN 2> /dev/null
  elif type -P ss &> /dev/null; then
    ss -ltnp "sport = :$port" 2> /dev/null | grep -oP 'pid=\K[0-9]+' | sort -u
  elif type -P fuser &> /dev/null; then
    fuser "$port/tcp" 2> /dev/null
  fi
}

function kill_port() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "kill_port: kill the process listening on a single TCP port
  Usage: kill_port <port>"
    return 0
  fi

  local port="$1"
  local pids
  pids="$(_find_pid_by_port "$port")"
  if [ -z "$pids" ]; then
    echo "  > Kill > Port $port > Skipped (nothing running on port)"
    return 0
  fi
  # Send TERM first, then KILL after 1s if still alive — avoids orphaning sockets.
  local killed=0
  local pid
  for pid in $pids; do
    kill $pid 2> /dev/null && killed=1
  done
  if ((killed)); then
    sleep 1
    for pid in $pids; do
      kill -0 $pid 2> /dev/null && kill -9 $pid 2> /dev/null
    done
    echo "  > Kill > Port $port > Success"
  else
    if [ "$port" -lt 1024 ]; then
      echo "  > Kill > Port $port > Error (privileged port, sudo may be required)"
    else
      echo "  > Kill > Port $port > Error (failed to kill process)"
    fi
    return 1
  fi
}

# kill_ports: kill processes listening on the given TCP ports
function kill_ports() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "kill_ports: kill processes listening on the given TCP ports
  Usage: kill_ports <port|range> [port|range ...]
  Examples:
    kill_ports 3000
    kill_ports 3000 3001 4000
    kill_ports 3000-4000
    kill_ports 80 3000-3005 8080"
    return 0
  fi

  local ports
  ports="$(_expand_port_args "$@")" || return 1

  local port needs_sudo=0 port_list=""
  while IFS= read -r port; do
    local status="free"
    if _find_pid_by_port "$port" &> /dev/null; then
      status="in use"
    fi
    if [ "$port" -lt 1024 ]; then
      port_list="${port_list}  port $port ($status) [requires sudo]\n"
      needs_sudo=1
    else
      port_list="${port_list}  port $port ($status)\n"
    fi
  done <<< "$ports"

  echo "The following ports will be targeted:"
  echo -e "$port_list"

  if ((needs_sudo)); then
    echo ">> Warning: some ports are below 1024 and may require admin/sudo to kill."
    echo ""
  fi

  if ! prompt_yes_no "Proceed with killing processes on these ports?"; then
    echo ">> Aborted."
    return 1
  fi

  echo ""
  while IFS= read -r port; do
    kill_port "$port"
  done <<< "$ports"
}

# portcheck: check if a TCP port is in use
function portcheck() {
  local port="$1"
  if [ -z "$port" ] || is_help_arg "$1"; then
    echo "portcheck: check if a TCP port is in use
  Usage: portcheck <port>"
    return 1
  fi
  if _find_pid_by_port "$port" &> /dev/null; then
    echo "Port $port is in use:"
    if type -P lsof &> /dev/null; then
      lsof -i tcp:"$port" -sTCP:LISTEN
    else
      ps -p "$(_find_pid_by_port "$port" | tr '\n' ',')" -o pid,comm 2> /dev/null
    fi
  else
    echo "Port $port is free"
  fi
}

# tunnel: expose a local server via Cloudflare Tunnel (cloudflared)
function tunnel() {
  if [ $# -eq 0 ] || is_help_arg "$1"; then
    echo "tunnel: expose a local server via Cloudflare Tunnel
  Usage: tunnel [port|url]
    tunnel 3000              → tunnel http://localhost:3000
    tunnel 8080              → tunnel http://localhost:8080
    tunnel http://localhost   → tunnel http://localhost (port 80)
  Requires cloudflared on PATH."
    return 0
  fi
  if ! type -P cloudflared &> /dev/null; then
    echo "tunnel: cloudflared not found on PATH" >&2
    return 1
  fi
  local target="$1"
  case "$target" in
  http://* | https://*) ;;
  *) target="http://localhost:$target" ;;
  esac
  echo ">> Tunneling $target via cloudflared"
  command cloudflared tunnel --url "$target"
}
