#!/usr/bin/env bash

################################################################################
# --- GitHub Actions Runner + Local Executor + Google Drive Vault ---
#
# Three cooperating shell tools. Full walkthrough: docs/github-actions-runner.md
#
# gh_runner_setup   — register THIS machine as a self-hosted GitHub Actions
#                     runner (repo-level or org-level), then optionally run it
#                     as a background service.
# gh_run_script     — LOCAL executor (no GitHub Actions): point it at a repo,
#                     gist, raw URL, or local file plus a command, and it fetches
#                     into a throwaway workspace and runs it here.
# gdrive_vault_push — copy a file into a Google Drive vault via rclone and print
#                     a shareable download link.
################################################################################

################################################################################
# --- Self-Hosted Runner Registration ---
################################################################################

# _gh_runner_arch_slug: map the native CPU arch to a GitHub Actions runner slug.
# Echoes "x64" or "arm64"; returns 1 on an unsupported arch.
function _gh_runner_arch_slug() {
  case "$(get_native_arch)" in
  arm64 | aarch64) echo "arm64" ;;
  x86_64 | amd64) echo "x64" ;;
  *)
    echo ">> Unsupported arch: $(get_native_arch)" >&2
    return 1
    ;;
  esac
}

# gh_runner_setup: register this machine as a self-hosted GitHub Actions runner
function gh_runner_setup() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "gh_runner_setup: register THIS machine as a self-hosted GitHub Actions runner
  Usage: gh_runner_setup <owner/repo>     register a repo-level runner
         gh_runner_setup --org <org>      register an org-level runner
  Env overrides:
    RUNNER_NAME=<name>    runner name shown in GitHub (default: this hostname)
    RUNNER_LABELS=<a,b>   extra comma-separated labels (default: none)
    RUNNER_DIR=<path>     install folder (default: \$HOME/actions-runner)
  Requires: gh authed ('gh auth status') with admin on the target, curl, tar.
  Examples:
    gh_runner_setup acme/widget-store
    RUNNER_LABELS=gpu,macos gh_runner_setup --org acme
  After it configures, it offers to install + start a background service so the
  runner survives logout. Remove later with: cd \$RUNNER_DIR && ./config.sh remove --token <token>"
    return 0
  fi

  if ! type -P gh > /dev/null 2>&1; then
    echo ">> gh (GitHub CLI) not found. Install it, then run 'gh auth login'." >&2
    return 1
  fi
  if ! gh auth status > /dev/null 2>&1; then
    echo ">> gh is not authenticated. Run 'gh auth login' first." >&2
    return 1
  fi

  # Resolve scope -> the API path that mints a registration token and the runner URL.
  local scope_url token_api
  if [ "$1" = "--org" ]; then
    local org="${2:-}"
    if [ -z "$org" ]; then
      echo ">> --org requires an organization name. See: gh_runner_setup --help" >&2
      return 1
    fi
    scope_url="https://github.com/${org}"
    token_api="orgs/${org}/actions/runners/registration-token"
  else
    local repo="$1"
    case "$repo" in
    */*) : ;; # owner/repo
    *)
      echo ">> Expected <owner/repo> or --org <org>, got: $repo" >&2
      return 1
      ;;
    esac
    scope_url="https://github.com/${repo}"
    token_api="repos/${repo}/actions/runners/registration-token"
  fi

  local reg_token
  reg_token="$(gh api --method POST "$token_api" --jq .token 2> /dev/null)"
  if [ -z "$reg_token" ]; then
    echo ">> Could not get a registration token from '$token_api'. Need admin on the target." >&2
    return 1
  fi

  local arch_slug os_slug
  arch_slug="$(_gh_runner_arch_slug)" || return 1
  case "$(uname -s)" in
  Darwin) os_slug="osx" ;;
  Linux) os_slug="linux" ;;
  *)
    echo ">> Self-hosted runner setup here supports macOS and Linux only." >&2
    return 1
    ;;
  esac

  # Latest runner release version, tag like "v2.317.0" -> "2.317.0".
  local version
  version="$(gh api repos/actions/runner/releases/latest --jq .tag_name 2> /dev/null | command sed 's/^v//')"
  if [ -z "$version" ]; then
    echo ">> Could not resolve the latest actions/runner release." >&2
    return 1
  fi

  local runner_dir="${RUNNER_DIR:-$HOME/actions-runner}"
  local tarball="actions-runner-${os_slug}-${arch_slug}-${version}.tar.gz"
  local url="https://github.com/actions/runner/releases/download/v${version}/${tarball}"

  mkdir -p "$runner_dir" || return 1
  echo ">> Downloading $tarball ..."
  if ! curl -fsSL -o "${runner_dir}/${tarball}" "$url"; then
    echo ">> Download failed: $url" >&2
    return 1
  fi
  (cd "$runner_dir" && tar xzf "$tarball") || return 1
  rm -f "${runner_dir}/${tarball}"

  local runner_name="${RUNNER_NAME:-$(command hostname -s 2> /dev/null || command hostname)}"
  local labels="self-hosted"
  [ -n "${RUNNER_LABELS:-}" ] && labels="${labels},${RUNNER_LABELS}"

  echo ">> Configuring runner '$runner_name' for $scope_url (labels: $labels) ..."
  (
    cd "$runner_dir" \
      && ./config.sh --unattended --replace \
        --url "$scope_url" \
        --token "$reg_token" \
        --name "$runner_name" \
        --labels "$labels"
  ) || {
    echo ">> config.sh failed." >&2
    return 1
  }

  if prompt_yes_no "Install and start the runner as a background service?" "y"; then
    if [ "$os_slug" = "osx" ]; then
      (cd "$runner_dir" && ./svc.sh install && ./svc.sh start)
    else
      # Linux svc.sh wraps systemd and needs root.
      (cd "$runner_dir" && sudo ./svc.sh install && sudo ./svc.sh start)
    fi
  else
    echo ">> Not installed as a service. Start it in the foreground with:"
    echo "     cd \"$runner_dir\" && ./run.sh"
  fi
}

################################################################################
# --- Local Executor (no GitHub Actions) ---
# Fetch a repo / gist / raw URL / local file into a throwaway workspace and run
# a command in it, right here on this box. This is NOT a GitHub Actions job.
################################################################################

# gh_run_script: fetch a source and run a command against it locally
function gh_run_script() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "gh_run_script: fetch a repo / gist / raw URL / local file and run it HERE (no GitHub Actions)
  Usage: gh_run_script <source> [command ...]
    <source> is one of:
      owner/repo                     shallow-cloned from GitHub
      https://github.com/owner/repo  shallow-cloned
      https://gist.github.com/...    gist cloned (needs gh)
      https://.../raw/.../file.sh    single raw file downloaded
      /path/to/local/file           run a file already on disk
    [command] runs inside the fetched workspace. Defaults:
      - a single fetched file        -> executed with bash
      - a cloned repo/gist           -> ./run.sh if present, else you must pass a command
  Examples:
    gh_run_script acme/widget-store ./ci/smoke.sh
    gh_run_script https://gist.github.com/me/abc123
    gh_run_script https://raw.githubusercontent.com/me/repo/HEAD/tools/x.sh
    gh_run_script ~/scratch/build.sh
  The workspace is a temp folder, removed when the command finishes."
    return 0
  fi

  local source="$1"
  shift

  # Local file: run in place, no fetch.
  if [ -f "$source" ]; then
    if [ "$#" -gt 0 ]; then
      (cd "$(dirname "$source")" && "$@")
    else
      bash "$source"
    fi
    return $?
  fi

  local workspace
  workspace="$(command mktemp -d "${BASHRC_TEMP_DIR:-${TMPDIR:-/tmp}}/gh_run_script.XXXXXX")" || return 1
  # shellcheck disable=SC2064
  trap "rm -rf \"$workspace\"" RETURN

  local single_file=""
  case "$source" in
  *gist.github.com*)
    if ! type -P gh > /dev/null 2>&1; then
      echo ">> Fetching a gist needs gh (GitHub CLI)." >&2
      return 1
    fi
    local gist_id="${source##*/}"
    gh gist clone "$gist_id" "$workspace/gist" > /dev/null 2>&1 || {
      echo ">> gist clone failed: $source" >&2
      return 1
    }
    workspace="$workspace/gist"
    ;;
  *raw.githubusercontent.com* | *raw* | *.sh | *.py | *.js | *.rb)
    # A single raw file URL.
    single_file="$workspace/$(basename "${source%%\?*}")"
    if ! curl -fsSL -o "$single_file" "$source"; then
      echo ">> Download failed: $source" >&2
      return 1
    fi
    ;;
  https://github.com/*/* | git@github.com:*/* | */*)
    local clone_url="$source"
    case "$source" in
    https://* | git@*) : ;;
    *) clone_url="https://github.com/${source}" ;;
    esac
    if ! git clone --depth 1 "$clone_url" "$workspace/repo" > /dev/null 2>&1; then
      echo ">> git clone failed: $clone_url" >&2
      return 1
    fi
    workspace="$workspace/repo"
    ;;
  *)
    echo ">> Unrecognized source: $source (see: gh_run_script --help)" >&2
    return 1
    ;;
  esac

  # Decide what to run.
  if [ "$#" -gt 0 ]; then
    (cd "$workspace" && "$@")
  elif [ -n "$single_file" ]; then
    bash "$single_file"
  elif [ -f "$workspace/run.sh" ]; then
    (cd "$workspace" && bash run.sh)
  else
    echo ">> Nothing to run. Pass a command, e.g.: gh_run_script $source ./setup.sh" >&2
    return 1
  fi
}

################################################################################
# --- Google Drive Vault (rclone) ---
# Copy a file into a Google Drive vault and print a shareable download link.
# Configure the remote once with 'rclone config' (type: drive).
################################################################################

# gdrive_vault_push: upload a file to the Google Drive vault, print a download link
function gdrive_vault_push() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "gdrive_vault_push: copy a file into a Google Drive vault (rclone) and print a download link
  Usage: gdrive_vault_push <file> [subfolder]
  Env overrides:
    GDRIVE_VAULT_REMOTE=<name>   rclone remote name (default: gdrive)
    GDRIVE_VAULT_FOLDER=<path>   folder inside the remote (default: vault)
  Requires: rclone configured with a Google Drive remote ('rclone config').
  Examples:
    gdrive_vault_push ~/report.pdf
    gdrive_vault_push ./build.tar.gz releases
  Prints the bare shareable URL on stdout (greppable, safe to pipe)."
    return 0
  fi

  local file="$1"
  if [ ! -f "$file" ]; then
    echo ">> File not found: $file" >&2
    return 1
  fi
  if ! type -P rclone > /dev/null 2>&1; then
    echo ">> rclone not found. Install it and run 'rclone config'." >&2
    return 1
  fi

  local remote="${GDRIVE_VAULT_REMOTE:-gdrive}"
  local base_folder="${GDRIVE_VAULT_FOLDER:-vault}"
  if ! rclone listremotes 2> /dev/null | command grep -q "^${remote}:"; then
    echo ">> rclone remote '${remote}:' not configured. Run 'rclone config'." >&2
    return 1
  fi

  local subfolder="${2:-}"
  local dest_folder="${remote}:${base_folder}"
  [ -n "$subfolder" ] && dest_folder="${dest_folder}/${subfolder}"

  echo ">> Uploading $(basename "$file") to ${dest_folder} ..." >&2
  if ! rclone copy "$file" "$dest_folder" > /dev/null 2>&1; then
    echo ">> Upload failed." >&2
    return 1
  fi

  local link
  link="$(rclone link "${dest_folder}/$(basename "$file")" 2> /dev/null)"
  if [ -z "$link" ]; then
    echo ">> Uploaded, but could not create a share link. Check the remote's permissions." >&2
    return 1
  fi
  echo "$link"
}
