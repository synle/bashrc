#!/usr/bin/env bash
################################################################################
# --- run.sh - Unified test runner script ---
#
# Usage:
#   bash run.sh                                    # Full run (auto-detects local repo or fetches from GitHub)
#   bash run.sh --files="git.js"                   # Run specific file(s)
#   bash run.sh --files="vim.js,git.js"            # Multiple files (comma-separated)
#   bash run.sh --files="""                        # Multiple files (multiline)
#     vim.js
#     git.js
#     vim-plug.sh
#   """
#   bash run.sh git.js                             # Bare args treated as files
#   bash run.sh git.js vim.js                      # Multiple bare args
#   bash run.sh --force-refresh                    # Force refresh node and reinstall
#   bash run.sh -f                                 # Shorthand for --force-refresh
#   bash run.sh --preset=lightweight               # Expand a named preset (its file list); see software/metadata/presets.jsonc
#   bash run.sh --preset=lightweight,heavyweight   # Multiple presets compose (file lists union)
#   bash run.sh --preset=editor                    # Partial match (case-insensitive substring); 1 hit auto-resolves, 2+ hits errors with suggestions
#   bash run.sh @llm                               # Bare @-marker → strict preset lookup (skip script search)
#   bash run.sh editors                            # Bare arg → script-first; falls back to preset on miss
#   bash run.sh --debug                            # Enable debug mode (keep temp scripts for inspection)
#   bash run.sh -D                                 # Shorthand for --debug
#   bash run.sh --verbose                          # Enable verbose mode (set -x for bash tracing)
#   bash run.sh -V                                 # Shorthand for --verbose
#   bash run.sh --dryrun                           # Show what would change without writing files
#   bash run.sh --remove --files="fzf.js"          # Remove a script's config (runs undoWork)
#
# Single dash also works: -files=..., -force-refresh, -f, -preset=..., -debug, -D, -verbose, -V, -dryrun, -remove
################################################################################

################################################################################
# --- Prerequisites - OS Flags & Helpers ---
################################################################################

################################################################################
# --- common-env.sh - Shared environment setup for run.sh and Makefile build targets ---
# Sets up repo identifiers, URL exports, OS detection flags,
# and writes ~/.bash_syle_common
################################################################################
################################################################################
# --- Repo & Path Constants ---
################################################################################
# BEGIN software/bootstrap/common-env.sh
# software/bootstrap/common-env.sh | 67a5def8aaec6d3e6ffcc4e83a1f62e8 | 9.0 KB
# Shared environment constants sourced by run.sh (via BEGIN/END) and vite.config.js.
export TZ=UTC
export REPO_PATH_IDENTIFIER="synle/bashrc"
export REPO_BRANCH_NAME="main"
export BASH_SYLE_PATH="$HOME/.bash_syle"
export BASH_SYLE_COMMON_PATH="$HOME/.bash_syle_common"
export BASH_SYLE_CACHE_PATH="$HOME/.bash_syle_cache"
export BASH_PROFILE_CODE_REPO_RAW_URL="https://github.com/$REPO_PATH_IDENTIFIER/blob/HEAD" # https://github.com/synle/bashrc/blob/HEAD
# Personal root - one visible folder under $HOME owning everything this setup
# creates for the user rather than for a tool. `_extra` is the folder that
# already held the custom-tweaks staging (fonts, downloaded binaries, per-OS
# scratch), so adopting it as the root keeps ONE personal folder under $HOME
# instead of standing a second one beside it.
# THIS IS THE ONLY DECLARATION. Consumers derive their own subfolder from it and
# never write a second $HOME literal, and they read it DIRECTLY - no `${...:-...}`
# default anywhere else. A per-consumer default looks defensive but is a second
# declaration in disguise: the day this line moves, every copy goes on resolving
# happily to the old path and the surfaces disagree silently. Unset means run.sh
# never ran, and an obviously-broken path is the correct, visible outcome.
#   bash   "$SY_ROOT_FOLDER/<thing>" - run.sh re-exports it into
#          ~/.bash_syle_common, so interactive shells and profile partials see it
#   node   SY_ROOT_FOLDER in software/index.js, read from this same env var
#   docs   deployed LLM docs write the <<SY_ROOT_FOLDER>> / <<LLM_ROOT_FOLDER>>
#          placeholder, resolved to a real path by llm-common.js at deploy time
# NOTE: `make nuke` must never rm -rf this folder wholesale - it holds authored
# plan files that no re-run can regenerate. See the nuke target.
export SY_ROOT_FOLDER="$HOME/_extra"

# LLM home - every Sy-managed LLM artifact that lives outside a repo checkout
# (instructions/, plans/, skills/). Declared HERE rather than in llm-common.js
# because both surfaces need it and only common-env.sh reaches both: node reads
# it as an env var, and run.sh re-exports it into ~/.bash_syle_common so the
# shell dispatcher partial resolves the same folder without a second literal.
# All the LOGIC (the legacy-folder detector, symlink ownership) stays in
# software/scripts/advanced/llm/llm-common.js — this is only the location.
# Moving it means editing this line and adding a row to LLM_LEGACY_FOLDERS so a
# machine left holding the old folder is told about it rather than stranded.
export LLM_ROOT_FOLDER="$SY_ROOT_FOLDER/ai_llm"
export LIMITED_SUPPORT_OSES="is_os_android_termux,is_os_mingw64"
export ALL_OS_FLAGS="is_os_mac,is_os_ubuntu,is_os_chromeos,is_os_mingw64,is_os_android_termux,is_os_arch_linux,is_os_steamos,is_os_redhat,is_os_windows,is_os_wsl"

# Detect physical battery to set is_system_laptop / is_system_desktop.
# Used by scripts that tune resource usage to expected power envelope
# (e.g. software/scripts/advanced/llm/ollama.profile.bash gates OLLAMA_NUM_PARALLEL
# and OLLAMA_KV_CACHE_TYPE on this flag).
#
# Detection cascade — first probe that yields a battery flips the host to laptop;
# every probe silent → desktop default. Order = cheap/local probes first, slow
# subprocess (powershell.exe cold-start) last so WSL/mingw64 setups don't stall
# 30-60s of silence on first invocation while CLR loads.
#   1. macOS: pmset -g batt | grep InternalBattery
#      - Laptops print "-InternalBattery-0 (id=...)"; iMac / Mac mini / Mac Studio
#        / Mac Pro print only the AC line, so grep -q exits 1. ~12ms, documented
#        in `man pmset`, present on every macOS since 10.5.
#   2. Linux / ChromeOS / Steam Deck / Termux: /sys/class/power_supply/BAT*
#      - The canonical Linux power-supply sysfs path. UPower, GNOME, KDE, and
#        every modern battery applet read from it. Works on Chromebooks
#        (Chrome OS Linux container), Steam Deck (handheld battery), and Termux
#        on Android (where it surfaces the phone's battery). Uses `ls` rather
#        than a glob expansion so it stays bash-3.2-safe.
#   3. powershell.exe Get-CimInstance Win32_Battery (Windows / WSL / mingw64)
#      - Last resort because WSL2's /sys/class/power_supply is sparse (no BAT*
#        device exposed) so step 2 misses laptops where Windows is the source
#        of truth. Guarded by `type -P powershell.exe` so native Linux skips
#        the spawn entirely, and capped with `timeout 5` so a cold/slow Windows
#        host can't stall the whole shell startup. 5s false-negative on a
#        heavily-loaded laptop is acceptable — this flag only tunes resource
#        envelopes, never correctness.
if type -P pmset > /dev/null 2>&1 && pmset -g batt 2> /dev/null | grep -q InternalBattery; then
  export is_system_laptop=1
  export is_system_desktop=0
elif ls /sys/class/power_supply/BAT* > /dev/null 2>&1; then
  export is_system_laptop=1
  export is_system_desktop=0
elif type -P powershell.exe > /dev/null 2>&1 \
  && [[ -n $(timeout 5 powershell.exe -Command "Get-CimInstance Win32_Battery" 2> /dev/null | tr -d '\r') ]]; then
  export is_system_laptop=1
  export is_system_desktop=0
else
  export is_system_laptop=0
  export is_system_desktop=1
fi

# --- Display / GUI Detection ---
# _detect_gui_flags - Single source of truth for "does this host have a display?".
# Sets and exports three 0/1 flags, mirroring the is_os_* / is_system_* convention:
#
#   is_gui_x11      1 iff $DISPLAY is set — an X11 (or XWayland / WSLg / Termux:X11)
#                   server is reachable. Picks x11-only tools (xclip, wmctrl, xrandr).
#   is_gui_wayland  1 iff $WAYLAND_DISPLAY is set — a Wayland compositor is reachable.
#                   Picks wayland-only tools (wl-copy/wl-paste, wlr-randr, swaymsg).
#   is_gui          1 iff a GUI surface exists at all. Use this for "should we
#                   install/run GUI apps?". mac and Windows always have a desktop
#                   session, so they are 1 unconditionally; every other platform
#                   needs an X11 or Wayland server.
#
# SSH sessions force is_gui=0: the remote box may well have a physical monitor, but
# nothing we launch there is visible to the person on the other end of the pipe, so
# GUI installs and window-manager calls are wasted work. is_gui_x11 deliberately
# stays 1 under `ssh -X` — X11 forwarding really does give xclip a working server.
#
# Cheap and side-effect free (pure env reads, no subprocess), so it is safe to call
# on every shell start. Re-callable: run `_detect_gui_flags` by hand after changing
# $DISPLAY in a live shell to refresh the flags.
#
# Overrides: $BASHRC_FORCE_IS_GUI / _X11 / _WAYLAND (set by run.sh from
# `--is_gui=0` and friends) win over detection. The override lives INSIDE this
# function rather than being exported over it afterwards because $BASH_ENV points
# every non-interactive bash at ~/.bash_syle_common, so the emitted install script
# — and every node heredoc it spawns — re-runs this function and would otherwise
# silently recompute the detected value back on top of the override.
#
# Consumers:
#   bash     ((is_gui)) / ((is_gui_x11)) / ((is_gui_wayland))
#   node     is_gui / is_gui_x11 / is_gui_wayland globals + exitIfNoGui() (software/index.js)
#
# Read by run.sh via $BASH_SYLE_COMMON_PATH (which invokes this after the is_os_*
# exports), so node inherits the flags as environment variables. Override for a
# single run with `bash run.sh --is_gui=0` to rehearse a headless install.
function _detect_gui_flags() {
  is_gui_x11=0 && [ -n "${DISPLAY:-}" ] && is_gui_x11=1
  is_gui_wayland=0 && [ -n "${WAYLAND_DISPLAY:-}" ] && is_gui_wayland=1

  is_gui=0
  if [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_CLIENT:-}" ]; then
    is_gui=0
  elif ((${is_os_mac:-0} || ${is_os_windows:-0} || is_gui_x11 || is_gui_wayland)); then
    is_gui=1
  fi

  # Explicit overrides win, and are applied last so they survive a re-detect.
  # Compared against a literal 0/1 rather than run through is_truthy so this
  # function stays dependency-free — it is declared into ~/.bash_syle_common and
  # runs in contexts where the other helpers may not be defined yet. run.sh
  # normalizes the user-supplied value to exactly "0" or "1" before exporting.
  case "${BASHRC_FORCE_IS_GUI:-}" in 0 | 1) is_gui="$BASHRC_FORCE_IS_GUI" ;; esac
  case "${BASHRC_FORCE_IS_GUI_X11:-}" in 0 | 1) is_gui_x11="$BASHRC_FORCE_IS_GUI_X11" ;; esac
  case "${BASHRC_FORCE_IS_GUI_WAYLAND:-}" in 0 | 1) is_gui_wayland="$BASHRC_FORCE_IS_GUI_WAYLAND" ;; esac

  export is_gui is_gui_x11 is_gui_wayland
}

# checks if a value is truthy (1, true, y, yes — case-insensitive)
function is_truthy() {
  if is_help_arg "${1:-}"; then
    echo "
      is_truthy: check if a value is truthy (1, true, y, yes — case-insensitive)
        is_truthy 1           returns 0 (success)
        is_truthy yes         returns 0 (success)
        is_truthy false       returns 1 (failure)
        is_truthy \"\${1:-}\" && do_something
    "
    return 0
  fi
  local _val
  _val=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
  case "$_val" in 1 | true | y | yes) return 0 ;; *) return 1 ;; esac
}
# END software/bootstrap/common-env.sh

################################################################################
# --- User Identity ---
################################################################################
export REPO_USER_NAME="syle"
export REPO_USER_EMAIL="$(git config --global user.email 2> /dev/null)"

################################################################################
# --- Environment Tooling ---
################################################################################
export NODE_JS_VERSION="24"
export FNM_DIR="$HOME/.local/share/fnm"

################################################################################
# --- Native CPU Arch (Apple Silicon / Rosetta 2) ---
# When run.sh is launched from a translated x86_64 process on Apple Silicon — the
# common case is an Intel node build shimming the whole session — every child
# inherits that arch. Homebrew then resolves x86_64 bottles and casks, curl|bash
# installers fetch Intel builds, and bun-compiled CLIs warn "CPU lacks AVX
# support, strange crashes may occur" because Rosetta 2 does not emulate AVX.
# Re-exec once through `arch` so the whole run sees the machine's real arch.
# Skipped when piped (curl | bash) since $0 is then not a readable script, and
# when the native re-exec probe fails, so a bad `arch` can never kill the run.
# Inlined rather than using run_native from common-functions.bash: that file is
# fetched later in the run, and the switch has to happen before any install work.
################################################################################
if [ -z "${BASHRC_NATIVE_ARCH_REEXEC:-}" ] && [ "$(uname -s)" = "Darwin" ] \
  && [ "$(sysctl -n sysctl.proc_translated 2> /dev/null)" = "1" ] \
  && [ "$(sysctl -n hw.optional.arm64 2> /dev/null)" = "1" ] \
  && [ -f "$0" ] && arch -arm64 /usr/bin/true > /dev/null 2>&1; then
  export BASHRC_NATIVE_ARCH_REEXEC=1
  echo ">> Rosetta 2 detected on Apple Silicon >> re-running natively as arm64"
  exec arch -arm64 /bin/bash "$0" "$@"
fi

################################################################################
# --- Formatting Constants ---
################################################################################
export LINE_BREAK_COUNT=80
export LINE_BREAK_HASH=$(printf '#%.0s' $(seq 1 $LINE_BREAK_COUNT))
export PRINT_WIDTH_BREAK_COUNT=140
################################################################################
# --- mktemp Polyfill ---
# Try the real mktemp first (honors /tmp and $TMPDIR). If it fails (e.g. a host
# with no writable /tmp and no usable $TMPDIR such as Android Termux), retry
# with the temp target forced to ~/tmp. Delegates all flag/template parsing to
# the real mktemp via "$@" so it transparently supports -d, -t, suffixes, etc.
################################################################################
function mktemp() {
  command mktemp "$@" 2> /dev/null && return 0
  local _fallback="$HOME/tmp"
  command mkdir -p "$_fallback" 2> /dev/null || return 1
  command mktemp -p "$_fallback" "$@"
}

get_home_ip_address() {
  local hostname="$1"
  local url="https://raw.githubusercontent.com/${REPO_PATH_IDENTIFIER}/refs/heads/main/software/metadata/ip-address.config"

  # Fetch the config via curl and parse it using awk
  curl -s "$url" | awk -F'[:,|]' -v host="$hostname" '
        # Skip empty lines, comments, or section headers starting with =
        /^[[:space:]]*([=#]|$)/ { next }

        {
            # Extract and trim the IP address (first token)
            ip = $1;
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", ip);

            # Iterate through remaining tokens to check for the matching hostname
            for (i = 2; i <= NF; i++) {
                token = $i;
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", token);

                # If a match is found, print the IP and exit immediately
                if (token == host) {
                    print ip;
                    exit;
                }
            }
        }
    '
}

################################################################################
# --- Temp Root (single source of truth for all scratch paths) ---
# Prefer /tmp when writable so mac + Linux keep today's /tmp/synle/bashrc layout.
# Only when /tmp is unwritable (Termux / locked-down hosts) defer to the mktemp
# polyfill, which resolves to $TMPDIR (Termux) or ~/tmp (last-ditch).
################################################################################

# _resolve_temp_root - Determine writable temp root.
# Prefers /tmp when writable; falls back to mktemp-derived parent; last resort ~/tmp.
# Extracted as a function so osDetection-style test harnesses can replay it.
function _resolve_temp_root() {
  if [ -d /tmp ] && [ -w /tmp ]; then
    echo "/tmp"
    return
  fi
  local _probe
  _probe=$(mktemp -d 2> /dev/null)
  if [ -n "$_probe" ] && [ -d "$_probe" ]; then
    local _parent="${_probe%/*}"
    rmdir "$_probe" 2> /dev/null || true
    echo "$_parent"
    return
  fi
  echo "$HOME/tmp"
}

export BASHRC_TEMP_ROOT_DIR="$(_resolve_temp_root)/$REPO_PATH_IDENTIFIER"
export BASHRC_TEMP_DIR="$BASHRC_TEMP_ROOT_DIR/$(date '+%Y_%m_%d_%H_%M')"
# Snapshot $HOME before any sudo runs. RHEL/Fedora sudoers sets `always_set_home`,
# which resets HOME to /root even with `sudo -E`. .su.js bundles run under sudo,
# so os.homedir() and $HOME both return /root there. This custom env var survives
# because sudoers only resets HOME, not arbitrary vars.
export BASE_HOMEDIR_LINUX="$HOME"

################################################################################
# --- OS Detection ---
################################################################################
# _detect_os [--name <csv>] [--bin <csv>] [--path <csv>] [--env <csv>]
# Returns 0 when the OS matches. All flags accept CSV values. Checks in order:
#   1. /etc/os-release ID/ID_LIKE contains any --name keyword
#   2. OSTYPE contains any --name keyword
#   3. /proc/version contains any --name keyword
#   4. Path exists (if --path given, file or folder)
#   5. Binary found in PATH (if --bin given)
#   6. Env var is non-empty (if --env given)
function _detect_os() {
  local names="" bins="" paths="" envs=""
  while [ $# -gt 0 ]; do
    case "$1" in
    --name)
      names="$2"
      shift 2
      ;;
    --bin)
      bins="$2"
      shift 2
      ;;
    --path)
      paths="$2"
      shift 2
      ;;
    --env)
      envs="$2"
      shift 2
      ;;
    *) shift ;;
    esac
  done

  local IFS=','

  # check --name keywords against /etc/os-release, OSTYPE, and /proc/version (contains match)
  if [ -n "$names" ]; then
    local pattern=""
    for keyword in $names; do
      keyword=$(echo "$keyword" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      if [ -n "$keyword" ]; then
        pattern="${pattern:+$pattern|}ID(_LIKE)?=.*$keyword"
        [[ "$OSTYPE" == *"$keyword"* ]] && return 0
        command grep -qi "$keyword" /proc/version 2> /dev/null && return 0
      fi
    done
    command grep -Eiq "$pattern" /etc/os-release 2> /dev/null && return 0
  fi

  # check paths (file or folder)
  for p in $paths; do
    p=$(echo "$p" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -n "$p" ] && [ -e "$p" ] && return 0
  done

  # check binaries
  for b in $bins; do
    b=$(echo "$b" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -n "$b" ] && type -P "$b" &> /dev/null && return 0
  done

  # check env vars
  for e in $envs; do
    e=$(echo "$e" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -n "$e" ] && [ -n "${!e:-}" ] && return 0
  done

  return 1
}

# Detect specific OSes first. is_os_ubuntu is the catch-all for Debian-family
# detection — it checks last and only fires if no other Linux distro matched.
# Why: GitHub Actions runners (and other containerized environments) share
# /proc/version with the Ubuntu host kernel, which would otherwise cause
# is_os_ubuntu=1 to leak onto Arch / RedHat / SteamOS / etc., running both
# _full-setup.sh files (apt + pacman/dnf) on the same machine.
is_os_mac=0 && _detect_os --name "darwin" --path "/Applications" --bin "brew" && is_os_mac=1
is_os_chromeos=0 && _detect_os --name "cros" --path "/dev/.cros_milestone" && is_os_chromeos=1
is_os_mingw64=0 && _detect_os --name "msys, cygwin" --path "/mingw64" && is_os_mingw64=1
is_os_android_termux=0 && _detect_os --env "TERMUX_VERSION" --path "/data/data/com.termux" && is_os_android_termux=1
is_os_arch_linux=0 && _detect_os --name "arch, steamos" --bin "pacman" && is_os_arch_linux=1
is_os_steamos=0 && _detect_os --name "steamos" && is_os_steamos=1
is_os_redhat=0 && _detect_os --name "fedora, rhel, centos, rocky, alma" --bin "dnf, yum" && is_os_redhat=1
# is_os_ubuntu MUST come last among Linux distro flags so a host-kernel
# /proc/version match can't override a real arch/redhat/etc. detection.
is_os_ubuntu=0
if ! ((is_os_mac || is_os_chromeos || is_os_mingw64 || is_os_android_termux || is_os_arch_linux || is_os_steamos || is_os_redhat)); then
  _detect_os --name "ubuntu, debian, mint" --bin "apt-get" && is_os_ubuntu=1
fi
# is_os_windows / is_os_wsl are independent overlays — WSL Ubuntu legitimately
# sets is_os_ubuntu=1 AND is_os_windows=1, so these check after the guard above.
is_os_windows=0 && _detect_os --name "microsoft" --path "/mnt/c/Windows, /c/Windows" && is_os_windows=1
is_os_wsl=0 && ((is_os_windows)) && is_os_wsl=1

IS_CI=0 && [ -n "$CI" ] && IS_CI=1
NO_COLOR="${NO_COLOR:-0}" && [ -n "$NO_COLOR" ] && [ "$NO_COLOR" != "0" ] && NO_COLOR=1 || NO_COLOR=0

os_flags=""
for var in $(compgen -v | grep '^is_os_\|^IS_CI$'); do
  os_flags="$os_flags
export $var=${!var}"
  unset "$var"
done
unset var

################################################################################
# --- Signal Handling ---
################################################################################
# Ctrl+C / SIGTERM: kill the entire process group (node|tee|bash pipeline) and exit immediately.
trap 'trap - INT TERM; kill 0' INT TERM

################################################################################
# --- Utility Functions ---
################################################################################

# prevent curl from using cached responses
alias curl="curl -H 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' -H 'Pragma: no-cache' -H 'Expires: 0' -H 'If-None-Match:' -H 'If-Modified-Since:'"

################################################################################
# --- CI Mode ---
################################################################################
if ((IS_CI)); then
  function echo() {
    case "$*" in
    ">"* | "<"*)
      command echo "::endgroup::"
      local icons="" remainder="$*"
      while case "$remainder" in ">"*) icons="${icons}🚀" remainder="${remainder#?}" ;; *) false ;; esac do :; done
      while case "$remainder" in "<"*) icons="${icons}⭐" remainder="${remainder#?}" ;; *) false ;; esac do :; done
      command echo "::group::${icons}${remainder}"
      ;;
    *) command echo "$@" ;;
    esac
  }
fi

################################################################################
# --- Bootstrap Node ---
################################################################################

# install_bootstrap_node - Ensure node (and npm) is available for running software/index.js
# Checks for existing node first, then falls back to downloading
# a standalone Node binary to $BASHRC_TEMP_ROOT_DIR/node/.
function install_bootstrap_node() {
  local node_tmp="$BASHRC_TEMP_ROOT_DIR/node"
  local fnm_default_bin="$FNM_DIR/aliases/default/bin"

  # Reset stale /usr/local/bin/{node,npm,npx,...} symlinks left by a previous
  # run's standalone-node fallback (target $BASHRC_TEMP_ROOT_DIR/node/bin/*). They
  # survive across runs and shadow fnm-managed node — `which node` resolves to
  # /usr/local/bin/node -> $BASHRC_TEMP_ROOT_DIR/... (often deleted) instead of
  # fnm's default. If fnm has a default node installed, repoint the symlink at
  # the stable $FNM_DIR/aliases/default/bin/<name> path (tracks the current fnm
  # default automatically). Otherwise just remove the dangling link.
  if [ -d /usr/local/bin ]; then
    local _link _target _name
    for _link in /usr/local/bin/*; do
      [ -L "$_link" ] || continue
      _target=$(readlink "$_link" 2> /dev/null)
      case "$_target" in
      "$node_tmp"/*)
        _name=$(basename "$_link")
        if [ -x "$fnm_default_bin/$_name" ]; then
          sudo ln -sf "$fnm_default_bin/$_name" "$_link" 2> /dev/null \
            || ln -sf "$fnm_default_bin/$_name" "$_link" 2> /dev/null \
            || true
        else
          sudo rm -f "$_link" 2> /dev/null || rm -f "$_link" 2> /dev/null || true
        fi
        ;;
      esac
    done
    unset _link _target _name
  fi

  export PATH="$PATH:$node_tmp/bin"

  # Use existing node if already available
  if type -P node > /dev/null 2>&1; then
    echo ">> Using node from PATH ($(node -v 2> /dev/null))"
    return
  fi

  # Termux: install via pkg instead of standalone download
  if ((is_os_android_termux)); then
    echo ">> Installing nodejs-lts via pkg (Termux)"
    pkg install -y nodejs-lts
    if type -P node > /dev/null 2>&1; then
      echo ">> Using node from pkg ($(node -v 2> /dev/null))"
      return
    fi
    echo ">> pkg install failed, falling through to standalone download"
  fi

  # Fallback: download standalone node to /tmp
  echo ">> Downloading standalone Node $NODE_JS_VERSION"
  rm -rf "$node_tmp"
  mkdir -p "$node_tmp"

  local os arch
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)

  # `uname -m` reports x86_64 for ANY process translated by Rosetta 2, so an
  # Apple Silicon Mac reached through a translated shell would download an Intel
  # node here — and every later arch decision inherits it, because node's own
  # process.arch then reports x64 too. hw.optional.arm64 is the kernel's answer
  # about the silicon and Rosetta does not fake it, so it wins. The re-exec above
  # normally makes this moot, but it is skipped for piped runs (curl | bash),
  # which is exactly where a translated shell sneaks through.
  if [ "$os" = "darwin" ] && [ "$(sysctl -n hw.optional.arm64 2> /dev/null)" = "1" ]; then
    arch="arm64"
  fi

  case "$arch" in
  x86_64) arch="x64" ;;
  aarch64 | arm64) arch="arm64" ;;
  armv7l) arch="armv7l" ;;
  esac

  local full_version
  full_version=$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_JS_VERSION}.x/SHASUMS256.txt" \
    | head -1 | grep -o 'node-v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*' | head -1 | sed 's/node-//')

  if [ -z "$full_version" ]; then
    echo "[Error] Failed to resolve Node $NODE_JS_VERSION version. Exiting."
    exit 1
  fi

  curl -fsSL "https://nodejs.org/dist/${full_version}/node-${full_version}-${os}-${arch}.tar.xz" \
    | tar -xJ --strip-components=1 -C "$node_tmp"

  if [ ! -x "$node_tmp/bin/node" ]; then
    echo "[Error] Failed to download standalone Node binary. Exiting."
    exit 1
  fi

  echo ">> Using standalone node $(node -v 2> /dev/null) from $node_tmp"

  # Make node/npm/npx available to sudo (secure_path ignores user PATH)
  if [ -d "$node_tmp/bin" ] && [ -d /usr/local/bin ]; then
    for bin in "$node_tmp/bin"/*; do
      [ -x "$bin" ] || continue
      sudo ln -sf "$bin" "/usr/local/bin/$(basename "$bin")" 2> /dev/null \
        || ln -sf "$bin" "/usr/local/bin/$(basename "$bin")" 2> /dev/null \
        || true
    done
  fi
}

################################################################################
# --- Run Files ---
################################################################################

# run_files - Run script files through software/index.js
# Args are parsed by parseRawArgs() in index.js via BASHRC_RAW_ARGS env var.
# Auto-detects local repo (software/index.js exists) or fetches via tarball/git.
function run_files() {
  # temp dir contents (keep in sync with run.sh summary and JS scripts):
  #   run.sh         - re-runnable script of all emitted bash commands
  #   run.log        - stdout/stderr output from executing run.sh
  #   bash_syle.0-before-run       - pre-run backup (_init.js)
  #   bash_syle.1-after-bootstrap  - after template assembly (_init.js)
  #   bash_syle.2-before-cleanup   - after all scripts, before cleanup (~cleanup.js)
  #   bash_syle.3-after-cleanup    - after cleanup (~cleanup.js)
  #   bash_syle.4-after-flush      - after final flushProfileBlocks (index.js)
  mkdir -p "$BASHRC_TEMP_DIR"
  cp "$BASH_SYLE_COMMON_PATH" "$BASHRC_TEMP_DIR/run.sh" 2> /dev/null
  if [ -f "software/index.js" ]; then
    cat software/index.js
  else
    curl -fsSL "$BASH_PROFILE_CODE_REPO_RAW_URL/software/index.js?raw=1"
  fi | node | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "$BASHRC_TEMP_DIR/run.sh") | bash 2>&1 | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "$BASHRC_TEMP_DIR/run.log") 2>&1
}

################################################################################
# --- Write ~/.bash_syle_common ---
################################################################################
# Populates BASH_SYLE_COMMON_PATH with function definitions + env vars for login shells.

echo '' > "$BASH_SYLE_COMMON_PATH"

echo """
$LINE_BREAK_HASH
# Auto-generated by common-env.sh (https://github.com/$REPO_PATH_IDENTIFIER/blob/$REPO_BRANCH_NAME/software/bootstrap/common-env.sh)
# Do not edit by hand as it will be overridden
$LINE_BREAK_HASH
""" >> "$BASH_SYLE_COMMON_PATH"

declare -f mktemp >> "$BASH_SYLE_COMMON_PATH"
declare -f get_home_ip_address >> "$BASH_SYLE_COMMON_PATH"
declare -f is_truthy >> "$BASH_SYLE_COMMON_PATH"
declare -f _detect_gui_flags >> "$BASH_SYLE_COMMON_PATH"

echo """
$os_flags

# GUI/display flags are recomputed on every shell start rather than baked in:
# unlike is_os_*, \$DISPLAY / \$WAYLAND_DISPLAY / \$SSH_CONNECTION are per-session,
# so the same machine is headless over ssh and GUI on the console. Runs after the
# is_os_* exports above because is_gui consults is_os_mac / is_os_windows.
_detect_gui_flags

export SY_OMEN45L_IP="$(get_home_ip_address "sy-omen45l")"

export REPO_PATH_IDENTIFIER='$REPO_PATH_IDENTIFIER'
export REPO_BRANCH_NAME='$REPO_BRANCH_NAME'
export BASH_PROFILE_CODE_REPO_RAW_URL='$BASH_PROFILE_CODE_REPO_RAW_URL'
export BASH_SYLE_PATH='$BASH_SYLE_PATH'
export BASH_SYLE_COMMON_PATH='$BASH_SYLE_COMMON_PATH'
export BASHRC_TEMP_ROOT_DIR='$BASHRC_TEMP_ROOT_DIR'
export SY_ROOT_FOLDER='$SY_ROOT_FOLDER'
export LLM_ROOT_FOLDER='$LLM_ROOT_FOLDER'

export LINE_BREAK_COUNT='$LINE_BREAK_COUNT'
export LINE_BREAK_HASH='$LINE_BREAK_HASH'
export PRINT_WIDTH_BREAK_COUNT='$PRINT_WIDTH_BREAK_COUNT'

alias osflags=\"env | grep '^is_os_.*=1' | awk -F= '{print \$1}'\"
""" >> "$BASH_SYLE_COMMON_PATH"

. "$BASH_SYLE_COMMON_PATH"
export BASH_ENV="$BASH_SYLE_COMMON_PATH"
unset os_flags

################################################################################
# --- Pre-scan for flags that must take effect before node runs ---
# All other flags are parsed by parseRawArgs in index.js.
# Only --verbose (set -x), --no-color, and the is_gui_* overrides must apply
# before node starts.
#
# The is_gui overrides are handled here rather than in index.js because they must
# reach BOTH consumers: node reads them from the environment, and the emitted
# _full-setup.sh bash reads the same exported vars via `((is_gui))`. Overriding
# in JS alone would let the two disagree mid-run.
#
# They are exported as BASHRC_FORCE_IS_GUI* rather than as is_gui* directly
# because $BASH_ENV points every non-interactive bash at ~/.bash_syle_common,
# which re-runs _detect_gui_flags — the emitted install script and every node
# heredoc it spawns would silently recompute the detected value back on top of a
# plain is_gui export. _detect_gui_flags applies these overrides itself, last, so
# they survive any number of re-detects.
#   bash run.sh --setup --is_gui=0   # rehearse a headless install on a GUI box
################################################################################
for arg in "$@"; do
  case "$arg" in
  --verbose | -verbose | -V) set -x ;;
  --no-color | -no-color) export NO_COLOR=1 ;;
  --is_gui=* | -is_gui=*) is_truthy "${arg#*=}" && export BASHRC_FORCE_IS_GUI=1 || export BASHRC_FORCE_IS_GUI=0 ;;
  --is_gui_x11=* | -is_gui_x11=*) is_truthy "${arg#*=}" && export BASHRC_FORCE_IS_GUI_X11=1 || export BASHRC_FORCE_IS_GUI_X11=0 ;;
  --is_gui_wayland=* | -is_gui_wayland=*) is_truthy "${arg#*=}" && export BASHRC_FORCE_IS_GUI_WAYLAND=1 || export BASHRC_FORCE_IS_GUI_WAYLAND=0 ;;
  esac
done

# Re-detect so the override applies to this shell too (node inherits from here).
_detect_gui_flags

################################################################################
# --- Load PRESETS_JSON (named --preset bundles) ---
# Source of truth: software/metadata/presets.jsonc. parseRawArgs() in index.js
# expands --preset=<name> into files+modes by reading PRESETS_JSON. The .jsonc
# file is passed through verbatim — Node's loadPresets() strips // and /* */
# comments and trailing commas before JSON.parse, so we can carry the file
# contents (including comments) directly into the env var without preprocessing
# here. Read locally when running from a checkout, otherwise fetched from the
# repo at runtime.
################################################################################
if [ -f "software/metadata/presets.jsonc" ]; then
  PRESETS_JSON=$(cat software/metadata/presets.jsonc)
else
  PRESETS_JSON=$(curl -fsSL "$BASH_PROFILE_CODE_REPO_RAW_URL/software/metadata/presets.jsonc?raw=1" 2> /dev/null || echo "{}")
fi
export PRESETS_JSON

################################################################################
# --- Encode $@ as JSON for node arg parsing (parseRawArgs in index.js) ---
# BASHRC_RAW_ARGS is a JSON array of all CLI arguments passed to run.sh
# (e.g. '["--files=git.js","--force-refresh"]'). Exported so that
# parseRawArgs() in software/index.js can parse flags like --files,
# --force-refresh, --dryrun, --remove, --preset, --setup, etc.
################################################################################
BASHRC_RAW_ARGS='['
_sep=""
for arg in "$@"; do
  _esc="${arg//\\/\\\\}"
  _esc="${_esc//\"/\\\"}"
  BASHRC_RAW_ARGS="${BASHRC_RAW_ARGS}${_sep}\"${_esc}\""
  _sep=","
done
BASHRC_RAW_ARGS="${BASHRC_RAW_ARGS}]"
export BASHRC_RAW_ARGS

################################################################################
# --- script: Run (single pipeline for files) ---
################################################################################

# --- Backup ~/.bash_syle for rollback ---
if [ -f "$BASH_SYLE_PATH" ] && [ -s "$BASH_SYLE_PATH" ]; then
  cp "$BASH_SYLE_PATH" "${BASH_SYLE_PATH}.bak"
  echo ">> Backed up ~/.bash_syle to ~/.bash_syle.bak"
fi

_run_start_epoch=$(date +%s)
_run_start_time=$(date '+%Y-%m-%d %H:%M:%S')

#benchmark
mkdir -p "$BASHRC_TEMP_DIR"
echo "{\"start\":\"$_run_start_time\"}" > "$BASHRC_TEMP_DIR/run_timing.json"

install_bootstrap_node

# Clear npm's cache and logs before any script runs. A corrupted/partial cache entry
# (common after an interrupted install) makes every later `npm install -g` fail with
# EINTEGRITY, and _logs/ grows unbounded across runs. Guarded on npm existing because
# the standalone-node fallback and Termux paths can leave node without npm.
if type -P npm > /dev/null 2>&1; then
  echo ">> Cleaning npm cache and logs"
  npm cache clean --force > /dev/null 2>&1 || true
  _npm_cache_folder=$(npm config get cache 2> /dev/null)
  # Guard: an empty/undefined cache path would make this `rm -rf /_logs`.
  case "$_npm_cache_folder" in
  /* | [A-Za-z]:*) rm -rf "$_npm_cache_folder/_logs" > /dev/null 2>&1 || true ;;
  esac
  unset _npm_cache_folder
fi

if type -P node > /dev/null 2>&1; then
  run_files
else
  echo "[Skip] Node is not installed — skipping main script."
fi

_run_end_epoch=$(date +%s)
_run_end_time=$(date '+%Y-%m-%d %H:%M:%S')
_run_duration=$((_run_end_epoch - _run_start_epoch))

#benchmark - merge end/duration into existing timing file (preserves scripts data from JS)
if type -P node &> /dev/null; then
  node -e "var f=require('fs'),p='$BASHRC_TEMP_DIR/run_timing.json',d={};try{d=JSON.parse(f.readFileSync(p,'utf8'))}catch(e){}d.start='$_run_start_time';d.end='$_run_end_time';d.duration_seconds=$_run_duration;f.writeFileSync(p,JSON.stringify(d))"
else
  echo "{\"start\":\"$_run_start_time\",\"end\":\"$_run_end_time\",\"duration_seconds\":$_run_duration}" > "$BASHRC_TEMP_DIR/run_timing.json"
fi

echo "
$LINE_BREAK_HASH
>> run.sh started at $_run_start_time
>> run.sh done at $_run_end_time (${_run_duration}s)
>> script: $BASHRC_TEMP_DIR/run.sh
>> log: $BASHRC_TEMP_DIR/run.log
>> timing: $BASHRC_TEMP_DIR/run_timing.json
>> snapshots: $BASHRC_TEMP_DIR/bash_syle.{0-before-run,1-after-bootstrap,2-before-cleanup,3-after-cleanup,4-after-flush}
>> tmp: $BASHRC_TEMP_DIR
$LINE_BREAK_HASH
"

################################################################################
# --- Re-source $BASH_SYLE_PATH so edits take effect in the calling shell ---
# Only effective when invoked via `. run.sh` / `source run.sh`. Under plain
# `bash run.sh` the source happens in the exiting subshell — no harm, no effect.
# Validate first so a syntax error does not poison the parent shell.
################################################################################
if [ -f "$BASH_SYLE_PATH" ] && bash -n "$BASH_SYLE_PATH" 2> /dev/null; then
  . "$BASH_SYLE_PATH"
fi

exit
