#!/usr/bin/env bash

################################################################################
# --- Docker-based folder sharing ---
#
# Wraps two well-known Docker images to expose a list of host folders over
# SMB (Samba) or FTP. Useful for quick LAN file sharing without installing
# samba/vsftpd natively.
#
# Functions:
#   samba_share <folder> [folder ...]                       — guest, no password
#   samba_share_with_password <user> <pass> <folder> ...    — authenticated
#   ftp_share <folder> [folder ...]                         — anonymous user
#   ftp_share_with_password <user> <pass> <folder> ...      — authenticated
#
# All four are idempotent: any prior container with the same name is stopped
# and removed before the new one is started. Containers run detached with
# --restart unless-stopped, so they survive reboots once created.
#
# Caveats:
#   - On Windows hosts, the LanmanServer service holds port 445. SMB will fail
#     to bind unless that service is stopped (not recommended). FTP works
#     everywhere because port 21 is free. WSL bash on a Windows host hits the
#     same conflict — Docker Desktop forwards the bind to the Windows host.
#   - Share names come from each folder's basename. If two folders share the
#     same basename, the second one wins.
################################################################################

# Container names — single instance per protocol; re-running replaces it.
DOCKER_SHARE_SAMBA_NAME="bashrc-samba-share"
DOCKER_SHARE_FTP_NAME="bashrc-ftp-share"

# Pinned images (canonical, widely-used).
DOCKER_SHARE_SAMBA_IMAGE="dperson/samba"
DOCKER_SHARE_FTP_IMAGE="stilliard/pure-ftpd"

# Verifies the docker CLI is on PATH and the daemon responds. Returns 0/1.
function _docker_share_check_docker() {
  if ! type -P docker &> /dev/null; then
    printf '%s\n' "ERROR: docker not found on PATH. Install Docker Desktop (Mac/Windows) or docker.io (Linux) first." >&2
    return 1
  fi
  if ! docker info &> /dev/null; then
    printf '%s\n' "ERROR: docker daemon not responding. Is Docker Desktop running?" >&2
    return 1
  fi
  return 0
}

# Best-effort LAN IP lookup so connection-info messages are copy-pasteable.
# Falls back to "<your-host-ip>" if no IP can be resolved.
function _docker_share_host_ip() {
  local ip=""
  if ((is_os_mac)); then
    ip=$(ipconfig getifaddr en0 2> /dev/null || ipconfig getifaddr en1 2> /dev/null)
  elif type -P hostname &> /dev/null; then
    ip=$(hostname -I 2> /dev/null | awk '{print $1}')
  fi
  if [ -z "$ip" ]; then ip="<your-host-ip>"; fi
  printf '%s\n' "$ip"
}

# Stops and removes an existing container if present. Silent no-op when the
# container doesn't exist.
function _docker_share_stop() {
  local name="$1"
  if docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    printf '%s\n' ">> Stopping existing container: $name"
    docker stop "$name" &> /dev/null || true
    docker rm "$name" &> /dev/null || true
  fi
}

# Validates every arg is an existing folder and prints absolute paths one per
# line on stdout. Uses `cd && pwd` for POSIX-compat resolution (avoids the
# `realpath` / `readlink -f` portability gap between Mac and Linux). Returns
# 1 (with a stderr diagnostic) on the first non-folder arg.
function _docker_share_resolve_folders() {
  local folder abs
  for folder in "$@"; do
    if [ ! -d "$folder" ]; then
      printf '%s\n' "ERROR: not a folder: $folder" >&2
      return 1
    fi
    abs=$(cd "$folder" 2> /dev/null && pwd)
    if [ -z "$abs" ]; then
      printf '%s\n' "ERROR: could not resolve absolute path for: $folder" >&2
      return 1
    fi
    printf '%s\n' "$abs"
  done
}

# Internal Samba implementation. Auth mode is controlled by USER/PASS:
# empty USER means guest mode (maps unknown clients to nobody so anonymous
# browse works); non-empty USER means single-user password auth.
function _docker_samba_share_impl() {
  local user="$1" pass="$2"
  shift 2
  if [ "$#" -eq 0 ]; then
    printf '%s\n' "ERROR: at least one folder is required" >&2
    return 1
  fi
  _docker_share_check_docker || return 1

  local folders
  folders=$(_docker_share_resolve_folders "$@") || return 1

  _docker_share_stop "$DOCKER_SHARE_SAMBA_NAME"

  # Build the docker run argv incrementally. Each share gets its own -v mount
  # under /shares/<basename> and a matching -s entry.
  local args=(run -d --name "$DOCKER_SHARE_SAMBA_NAME" --restart unless-stopped -p 445:445)
  local share_user_field share_guest_field
  if [ -n "$user" ]; then
    args+=(-u "${user};${pass}")
    share_user_field="$user"
    share_guest_field="no"
  else
    # Map unauthenticated clients to the built-in `nobody` account, otherwise
    # Samba rejects them before they can see any share.
    args+=(-g "map to guest = Bad User")
    share_user_field=""
    share_guest_field="yes"
  fi

  local f bname
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    bname=$(basename "$f")
    args+=(-v "${f}:/shares/${bname}")
    # dperson/samba -s format: name;path;browse;readonly;guest;users;...
    args+=(-s "${bname};/shares/${bname};yes;no;${share_guest_field};${share_user_field}")
  done <<< "$folders"

  args+=("$DOCKER_SHARE_SAMBA_IMAGE")

  printf '%s\n' ">> Starting Samba container: $DOCKER_SHARE_SAMBA_NAME (image: $DOCKER_SHARE_SAMBA_IMAGE)"
  docker "${args[@]}" || return 1

  local host_ip
  host_ip=$(_docker_share_host_ip)
  printf '%s\n' ""
  printf '%s\n' "Connection info:"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    bname=$(basename "$f")
    printf '%s\n' "  smb://${host_ip}/${bname}    ($f)"
  done <<< "$folders"
  if [ -n "$user" ]; then
    printf '%s\n' "  auth: user=${user}"
  else
    printf '%s\n' "  auth: guest (no password)"
  fi
  printf '%s\n' "  stop: docker stop ${DOCKER_SHARE_SAMBA_NAME}"
}

# samba_share — expose folders over SMB with guest (no-password) access.
function samba_share() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "samba_share: expose one or more host folders over SMB (Samba) via a Docker container, guest access."
    printf '%s\n' "  Usage:   samba_share <folder> [folder ...]"
    printf '%s\n' "  Example: samba_share \"\$HOME/Documents\" \"\$HOME/Pictures\""
    printf '%s\n' "  Stop:    docker stop ${DOCKER_SHARE_SAMBA_NAME}"
    printf '%s\n' "  See also: samba_share_with_password (authenticated)"
    return 0
  fi
  _docker_samba_share_impl "" "" "$@"
}

# samba_share_with_password — expose folders over SMB with user/pass auth.
function samba_share_with_password() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "samba_share_with_password: expose one or more host folders over SMB with username/password auth."
    printf '%s\n' "  Usage:   samba_share_with_password <user> <pass> <folder> [folder ...]"
    printf '%s\n' "  Example: samba_share_with_password syle hunter2 \"\$HOME/Documents\""
    printf '%s\n' "  Stop:    docker stop ${DOCKER_SHARE_SAMBA_NAME}"
    return 0
  fi
  if [ "$#" -lt 3 ]; then
    printf '%s\n' "ERROR: samba_share_with_password requires <user> <pass> <folder> [folder ...]" >&2
    return 1
  fi
  _docker_samba_share_impl "$@"
}

# Internal FTP implementation. Empty USER means anonymous — we use the
# username "anonymous" with password "anonymous" by convention (no client
# I've seen rejects this combo) so the same -e flags work for both modes.
function _docker_ftp_share_impl() {
  local user="$1" pass="$2"
  shift 2
  if [ "$#" -eq 0 ]; then
    printf '%s\n' "ERROR: at least one folder is required" >&2
    return 1
  fi
  if [ -z "$user" ]; then
    user="anonymous"
    pass="anonymous"
  fi
  _docker_share_check_docker || return 1

  local folders
  folders=$(_docker_share_resolve_folders "$@") || return 1

  _docker_share_stop "$DOCKER_SHARE_FTP_NAME"

  local host_ip
  host_ip=$(_docker_share_host_ip)

  # 30000-30009 is the default passive-mode port range for stilliard/pure-ftpd.
  # PUBLICHOST is required for passive mode to give clients the right callback IP.
  local args=(run -d --name "$DOCKER_SHARE_FTP_NAME" --restart unless-stopped
    -p 21:21 -p 30000-30009:30000-30009
    -e PUBLICHOST="$host_ip"
    -e FTP_USER_NAME="$user"
    -e FTP_USER_PASS="$pass"
    -e FTP_USER_HOME="/home/${user}")

  local f bname
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    bname=$(basename "$f")
    args+=(-v "${f}:/home/${user}/${bname}")
  done <<< "$folders"

  args+=("$DOCKER_SHARE_FTP_IMAGE")

  printf '%s\n' ">> Starting FTP container: $DOCKER_SHARE_FTP_NAME (image: $DOCKER_SHARE_FTP_IMAGE)"
  docker "${args[@]}" || return 1

  printf '%s\n' ""
  printf '%s\n' "Connection info:"
  printf '%s\n' "  ftp://${host_ip}/    (passive ports 30000-30009)"
  printf '%s\n' "  user: ${user}"
  printf '%s\n' "  pass: ${pass}"
  printf '%s\n' "  shares:"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    bname=$(basename "$f")
    printf '%s\n' "    /${bname}    ($f)"
  done <<< "$folders"
  printf '%s\n' "  stop: docker stop ${DOCKER_SHARE_FTP_NAME}"
}

# ftp_share — expose folders over FTP with anonymous access.
function ftp_share() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "ftp_share: expose one or more host folders over FTP via a Docker container, anonymous (user=anonymous, pass=anonymous)."
    printf '%s\n' "  Usage:   ftp_share <folder> [folder ...]"
    printf '%s\n' "  Example: ftp_share \"\$HOME/Documents\" \"\$HOME/Pictures\""
    printf '%s\n' "  Stop:    docker stop ${DOCKER_SHARE_FTP_NAME}"
    printf '%s\n' "  See also: ftp_share_with_password (authenticated)"
    return 0
  fi
  _docker_ftp_share_impl "" "" "$@"
}

# ftp_share_with_password — expose folders over FTP with user/pass auth.
function ftp_share_with_password() {
  if is_help_arg "${1:-}"; then
    printf '%s\n' "ftp_share_with_password: expose one or more host folders over FTP with username/password auth."
    printf '%s\n' "  Usage:   ftp_share_with_password <user> <pass> <folder> [folder ...]"
    printf '%s\n' "  Example: ftp_share_with_password syle hunter2 \"\$HOME/Documents\""
    printf '%s\n' "  Stop:    docker stop ${DOCKER_SHARE_FTP_NAME}"
    return 0
  fi
  if [ "$#" -lt 3 ]; then
    printf '%s\n' "ERROR: ftp_share_with_password requires <user> <pass> <folder> [folder ...]" >&2
    return 1
  fi
  _docker_ftp_share_impl "$@"
}
