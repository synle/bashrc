# Ollama performance env vars + operational helpers — tuned per platform
# SOURCE | software/bootstrap/common-functions.bash

# --- Daemon tuning ---
#
# IMPORTANT: these exports only reach an `ollama serve` started FROM a shell that
# sourced this profile. A daemon owned by systemd (Linux), `brew services`
# (macOS), or the Ollama.app menu-bar item does NOT inherit them — run
# `ollama_apply_daemon_env` once to persist the same values into the service
# manager, then `ollama_restart`.
#
# Why each one matters (defaults per ollama/envconfig/config.go):
#   OLLAMA_CONTEXT_LENGTH  default 0 = auto, which lands on a ~4k tier on modest
#                          VRAM. 4k is smaller than an agentic CLI's system
#                          prompt + tool schemas, so the request is truncated
#                          and the model stalls or answers nonsense mid-turn.
#                          Set it explicitly.
#   OLLAMA_NUM_PARALLEL    total server context = context_length x num_parallel
#                          (server/sched.go: effectiveLlamaServerContext). A high
#                          value multiplies KV-cache VRAM, trips the loader's OOM
#                          fallback, and silently shrinks the context back down.
#                          Single-user agent work wants 1-2, not 4.
#   OLLAMA_KEEP_ALIVE      default 5m. A multi-GB model evicted between turns
#                          costs a full reload on the next prompt, which reads
#                          as a hang in the CLI.
#   OLLAMA_KV_CACHE_TYPE   q8_0 halves KV memory at very small precision loss.
#                          q4_0 saves more but degrades code output noticeably —
#                          not worth it on either form factor.
#   OLLAMA_LOAD_TIMEOUT    stall detector during model load; the 5m default is
#                          tight for a large model on a cold page cache.
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_LOAD_TIMEOUT=10m

if ((is_system_desktop)); then
  # Desktop — more VRAM headroom: bigger context, one spare slot for a second agent.
  export OLLAMA_NUM_PARALLEL=2
  export OLLAMA_CONTEXT_LENGTH=32768
  export OLLAMA_KEEP_ALIVE=30m
  export OLLAMA_MAX_LOADED_MODELS=2
else
  # Laptop — conserve VRAM: single slot, smaller context, shorter residency.
  export OLLAMA_NUM_PARALLEL=1
  export OLLAMA_CONTEXT_LENGTH=16384
  export OLLAMA_KEEP_ALIVE=15m
  export OLLAMA_MAX_LOADED_MODELS=1
fi

# The OLLAMA_* names this repo manages. `ollama_apply_daemon_env` persists exactly
# this list into the service manager, so adding a var above is enough for it to be
# picked up there too.
export SY_OLLAMA_MANAGED_ENV_VARS="OLLAMA_FLASH_ATTENTION OLLAMA_KV_CACHE_TYPE OLLAMA_LOAD_TIMEOUT OLLAMA_NUM_PARALLEL OLLAMA_CONTEXT_LENGTH OLLAMA_KEEP_ALIVE OLLAMA_MAX_LOADED_MODELS"

# sy-omen45l connection details. The IP is looked up at profile-load time from
# software/metadata/ip-address.config (via get_home_ip_address) — the single source of
# truth for home-network addresses — so no address is hardcoded in any profile partial.
# Resolves to an empty string when the hostname is not listed there; consumers fall back
# to 127.0.0.1 in that case.
export SY_OMEN45L_OLLAMA_PORT="11434"

# SY_OMEN45L_OLLAMA_DEFAULT_MODEL is the SINGLE source of truth for the default model.
# Every consumer — ollama_warmup below, claude.profile.bash's claude_local, and the
# opencode/Zed/VS Code provider wiring — reads this variable and must NOT re-declare a
# `:-<model>` literal fallback. A second literal is exactly how these surfaces silently
# drift apart. This partial is sourced ahead of the per-CLI partials in
# profile-advanced.sh so the value is always set by the time any of them run.
#
# The `${VAR:-...}` form means an export placed earlier in the environment (a per-machine
# override in ~/.bash_custom_tweaks, or `SY_OMEN45L_OLLAMA_DEFAULT_MODEL=x claude_local`)
# wins over the repo default rather than being clobbered by it.
#
# Default rationale (RTX 5090 / 32 GB — see docs/local-llm-runtimes.md): 35B MoE with 3B
# active params, plus multi-token-prediction heads for extra throughput. 23 GB of weights,
# leaving room for KV cache alongside the co-loaded autocomplete model under
# OLLAMA_MAX_LOADED_MODELS=2.
#
# NOT `-nvfp4`, despite Blackwell having native FP4 tensor cores: Ollama's registry gates
# every `-nvfp4` tag to macOS and answers a pull from this box with
# `412: this model requires macOS`. The tag being listed on ollama.com/library does not
# mean it is pullable here. Re-verify any replacement tag against the DAEMON, not the
# website — the website lists tags the registry will still refuse:
#   curl -fsS "http://$SY_OMEN45L_IP:$SY_OMEN45L_OLLAMA_PORT/api/pull" -d '{"model":"<tag>"}'
export SY_OMEN45L_OLLAMA_DEFAULT_MODEL="${SY_OMEN45L_OLLAMA_DEFAULT_MODEL:-qwen3.6:35b-a3b-mtp-q4_K_M}"

# --- Endpoint helpers ---

# _ollama_url: normalize a bare host / host:port / full URL into a full Ollama base URL
#
# Internal helper shared by every function below so host handling is declared once.
# An empty argument resolves to $SY_OMEN45L_IP:$SY_OMEN45L_OLLAMA_PORT, falling back
# to 127.0.0.1:11434 when ip-address.config produced nothing.
function _ollama_url() {
  local env_ip="${SY_OMEN45L_IP:-127.0.0.1}"
  local env_port="${SY_OMEN45L_OLLAMA_PORT:-11434}"
  local host="${1:-${env_ip}:${env_port}}"

  # Keep an explicit scheme, add the default port when the caller omitted one,
  # and assume http:// for a bare host.
  if [[ "$host" =~ ^https?:// ]]; then
    if [[ "$host" =~ ^[a-zA-Z]+://[^:/]+$ ]]; then
      host="${host}:${env_port}"
    fi
  else
    if [[ "$host" != *:* ]]; then
      host="${host}:${env_port}"
    fi
    host="http://$host"
  fi

  echo "$host"
}

# _ollama_local_url: same normalization as _ollama_url but defaulting to loopback
#
# Used by the daemon-lifecycle helpers (ps / unload / warmup / doctor), which act on
# the machine you are sitting at rather than on the remote workstation.
function _ollama_local_url() {
  local env_port="${SY_OMEN45L_OLLAMA_PORT:-11434}"
  _ollama_url "${1:-127.0.0.1:${env_port}}"
}

# _ollama_model_context_length: print the context window (in tokens) a daemon will serve for a model
#
#   _ollama_model_context_length <host[:port]|url> <model>
#
# Asks the daemon rather than carrying a model->window table in this repo. A hardcoded
# table is wrong the moment a tag is re-quantized, the daemon's OLLAMA_CONTEXT_LENGTH
# changes, or a new model is pulled, and nothing would fail loudly when it drifts.
#
# Two sources, in order of authority:
#   1. GET /api/ps      - the window the model is ACTUALLY loaded with right now. This
#                         already reflects the daemon's own OLLAMA_CONTEXT_LENGTH and any
#                         shrink the loader applied when KV cache did not fit, so it is
#                         the only value that describes the session you are about to get.
#   2. POST /api/show   - the model's native maximum, used when it is not resident yet.
#                         Ollama clamps down from here, never up, so this is an upper
#                         bound rather than a guess.
# The key under model_info is family-qualified (`qwen35moe.context_length`,
# `gemma4.context_length`), hence the endswith match instead of a fixed key name.
#
# Prints one integer on stdout and returns 0 on success; prints nothing and returns 1
# when the host is unreachable, the model is unknown, or neither route exposed a window.
function _ollama_model_context_length() {
  local host model body
  host="$(_ollama_url "${1:-}")"
  model="${2:-}"
  [ -n "$model" ] || return 1

  local has_jq=0
  type -P jq > /dev/null 2>&1 && has_jq=1

  # 1. Resident window, if the model is already loaded.
  body="$(command curl -fsS --max-time 5 "$host/api/ps" 2> /dev/null)"
  if [ -n "$body" ] && ((has_jq)); then
    local resident
    resident="$(echo "$body" | jq -r --arg m "$model" '
      [ .models[]? | select(.name == $m or .model == $m) | .context_length // empty ] | first // empty' 2> /dev/null)"
    if [ -n "$resident" ] && [ "$resident" != "null" ]; then
      echo "$resident"
      return 0
    fi
  fi

  # 2. Native maximum from the model card.
  body="$(command curl -fsS --max-time 5 -X POST "$host/api/show" \
    -H 'content-type: application/json' \
    -d "{\"model\":\"$model\"}" 2> /dev/null)"
  [ -n "$body" ] || return 1

  local native=""
  if ((has_jq)); then
    native="$(echo "$body" | jq -r '
      [ (.model_info // {} | to_entries[] | select(.key | endswith(".context_length")) | .value),
        (.details.context_length // empty) ]
      | map(select(type == "number")) | first // empty' 2> /dev/null)"
  else
    # Basic-regex only: the profile aliases grep to rg, and -E / + are not portable
    # across both. `[0-9][0-9]*` is the POSIX spelling of `[0-9]+`.
    native="$(echo "$body" | grep -o '"[^"]*context_length": *[0-9][0-9]*' \
      | grep -o '[0-9][0-9]*$' | command head -n 1)"
  fi

  if [ -n "$native" ] && [ "$native" != "null" ]; then
    echo "$native"
    return 0
  fi
  return 1
}

# list_ollama_models: list the models an Ollama endpoint exposes via its /api/tags route
#
# Host defaults to $SY_OMEN45L_IP:$SY_OMEN45L_OLLAMA_PORT (see above; falls back to
# 127.0.0.1:11434 when the config lookup found nothing). Accepts hostnames with or
# without a scheme and/or port and normalizes them into a full URL.
function list_ollama_models() {
  if is_help_arg "${1:-}"; then
    echo "list_ollama_models: list models exposed by an Ollama endpoint
  Usage: list_ollama_models [host[:port]]

Host defaults to \$SY_OMEN45L_IP:\$SY_OMEN45L_OLLAMA_PORT, falling back to
127.0.0.1:11434. \$SY_OMEN45L_IP is resolved from
software/metadata/ip-address.config — edit that file to change the address.

Accepts a bare host (http:// and the default port are added), a host:port pair,
or a full URL. Prints one model name per line on stdout."
    return 0
  fi

  local host
  host="$(_ollama_url "${1:-}")"

  # Progress goes to stderr so the model list on stdout stays pipe-clean.
  echo "Fetching models from $host..." >&2
  # `command curl` bypasses the profile's formatting/HAR curl wrapper so the body
  # reaches grep unmodified and no HAR entry is written for a polling call.
  command curl -fsS --max-time 5 "$host/api/tags" 2> /dev/null | grep -o '"name": *"[^"]*"' | cut -d'"' -f4
}

# ollama_ps: show which models are resident, how much of each sits in VRAM, and when they expire
function ollama_ps() {
  if is_help_arg "${1:-}"; then
    echo "ollama_ps: list models currently loaded in an Ollama daemon
  Usage: ollama_ps [host[:port]]

Host defaults to 127.0.0.1:11434. Reads GET /api/ps and prints one row per
loaded model: name, total size, resident VRAM, context, and keep-alive expiry.

A resident size smaller than the total size means part of the model spilled to
CPU — inference drops several times slower and long turns start to look like a
hang. Fix by picking a smaller model or quant, or by lowering
\$OLLAMA_NUM_PARALLEL / \$OLLAMA_CONTEXT_LENGTH (see ollama_apply_daemon_env)."
    return 0
  fi

  local host
  host="$(_ollama_local_url "${1:-}")"
  local body
  body="$(command curl -fsS --max-time 5 "$host/api/ps" 2> /dev/null)"
  if [ -z "$body" ]; then
    echo "ollama_ps: no response from $host/api/ps" >&2
    return 1
  fi

  if type -P jq > /dev/null 2>&1; then
    echo "$body" | jq -r '
      if (.models | length) == 0 then "no models loaded"
      else .models[]
        | "\(.name)\tsize=\(((.size // 0) / 1073741824 * 10 | round) / 10)GB"
          + "\tvram=\(((.size_vram // 0) / 1073741824 * 10 | round) / 10)GB"
          + "\tctx=\(.context_length // "?")\texpires=\(.expires_at // "?")"
      end'
  else
    echo "$body"
  fi
}

# ollama_unload: evict a model from memory so a wedged or oversized load can be retried clean
function ollama_unload() {
  if is_help_arg "${1:-}"; then
    echo "ollama_unload: evict loaded models from an Ollama daemon
  Usage: ollama_unload [model] [host[:port]]

With no model, every model reported by /api/ps is evicted. Sends a chat request
with an empty message list and keep_alive=0, which is the documented way to
unload without restarting the daemon.

Try this first when a local model stops responding mid-turn: it frees VRAM and
forces a clean reload on the next prompt. Escalate to ollama_restart only when
unloading does not clear the stall."
    return 0
  fi

  local model="${1:-}"
  local host
  host="$(_ollama_local_url "${2:-}")"

  if [ -z "$model" ]; then
    local loaded
    loaded="$(command curl -fsS --max-time 5 "$host/api/ps" 2> /dev/null | grep -o '"name": *"[^"]*"' | cut -d'"' -f4)"
    if [ -z "$loaded" ]; then
      echo "ollama_unload: nothing loaded on $host"
      return 0
    fi
    local one
    for one in $loaded; do
      ollama_unload "$one" "$host"
    done
    return 0
  fi

  echo ">> unloading $model from $host"
  command curl -fsS --max-time 10 "$host/api/chat" \
    -H 'content-type: application/json' \
    -d "{\"model\":\"$model\",\"messages\":[],\"keep_alive\":0}" > /dev/null 2>&1
}

# ollama_warmup: preload a model so the first real prompt is not charged the load time
function ollama_warmup() {
  if is_help_arg "${1:-}"; then
    echo "ollama_warmup: preload a model into an Ollama daemon
  Usage: ollama_warmup [model] [host[:port]]

Model defaults to \$SY_OMEN45L_OLLAMA_DEFAULT_MODEL, host to 127.0.0.1:11434.
Sends a chat request with an empty message list, which loads the weights and
returns without generating. Run it before starting an agent session so the
first turn is not sitting on a multi-GB load."
    return 0
  fi

  # No `:-<model>` literal here on purpose — this partial's own export above is the
  # single source of truth for the default tag.
  local model="${1:-$SY_OMEN45L_OLLAMA_DEFAULT_MODEL}"
  local host
  host="$(_ollama_local_url "${2:-}")"

  echo ">> warming up $model on $host (loads the weights; can take a minute)"
  if command curl -fsS --max-time 600 "$host/api/chat" \
    -H 'content-type: application/json' \
    -d "{\"model\":\"$model\",\"messages\":[]}" > /dev/null 2>&1; then
    echo ">> $model is resident"
  else
    echo "ollama_warmup: load failed — check 'ollama_doctor $host'" >&2
    return 1
  fi
}

# --- Daemon lifecycle ---

# ollama_restart: restart the local Ollama daemon through whichever service manager owns it
function ollama_restart() {
  if is_help_arg "${1:-}"; then
    echo "ollama_restart: restart the local Ollama daemon
  Usage: ollama_restart

Picks the right mechanism for the platform:
  Linux         sudo systemctl restart ollama
  macOS (brew)  brew services restart ollama
  macOS (app)   quit and relaunch Ollama.app
  WSL           no-op — the daemon runs on the Windows host; restart it there
                with 'Restart-Service -Name Ollama' in an elevated PowerShell

Reach for this when ollama_unload did not clear a stall, or right after
ollama_apply_daemon_env so the new environment takes effect."
    return 0
  fi

  if ((is_os_windows)); then
    echo "ollama_restart: this is WSL — the Ollama daemon runs on the Windows host." >&2
    echo "  Run in an elevated PowerShell:  Restart-Service -Name Ollama" >&2
    return 1
  fi

  if ((is_os_mac)); then
    if type -P brew > /dev/null 2>&1 && brew services list 2> /dev/null | grep -q '^ollama'; then
      echo ">> brew services restart ollama"
      brew services restart ollama
      return
    fi
    if [ -d "/Applications/Ollama.app" ]; then
      echo ">> restarting Ollama.app"
      osascript -e 'quit app "Ollama"' > /dev/null 2>&1
      sleep 2
      open -a Ollama
      return
    fi
    echo "ollama_restart: no brew service and no /Applications/Ollama.app — start it manually with 'ollama serve'" >&2
    return 1
  fi

  if type -P systemctl > /dev/null 2>&1; then
    echo ">> sudo systemctl restart ollama"
    sudo systemctl restart ollama
    return
  fi

  echo "ollama_restart: no supported service manager found — start it manually with 'ollama serve'" >&2
  return 1
}

# ollama_apply_daemon_env: persist this profile's OLLAMA_* tuning into the service manager
function ollama_apply_daemon_env() {
  if is_help_arg "${1:-}"; then
    echo "ollama_apply_daemon_env: persist this profile's OLLAMA_* tuning into the daemon
  Usage: ollama_apply_daemon_env [--lan]

The exports at the top of this file only reach an 'ollama serve' you start by
hand. A daemon owned by systemd, brew services, or Ollama.app starts with a
clean environment and silently uses upstream defaults — most importantly a ~4k
auto context, which truncates agentic prompts mid-conversation.

Writes the managed vars (\$SY_OLLAMA_MANAGED_ENV_VARS) where the service
manager reads them:
  Linux   /etc/systemd/system/ollama.service.d/sy-bashrc.conf  (needs sudo)
  macOS   launchctl setenv, one call per var, in the user's launchd session

--lan additionally binds the daemon to 0.0.0.0 so other machines on the home
network can reach it. Off by default — only enable it on the box meant to
serve models to the rest of the house.

Idempotent: on Linux it rewrites only when the desired content differs, and
restarts the daemon for you. On macOS run ollama_restart afterwards. Confirm
either way with ollama_doctor."
    return 0
  fi

  local want_lan=0
  [ "${1:-}" = "--lan" ] && want_lan=1

  local var value
  if ((is_os_mac)); then
    for var in $SY_OLLAMA_MANAGED_ENV_VARS; do
      eval "value=\${$var:-}"
      [ -n "$value" ] || continue
      launchctl setenv "$var" "$value"
    done
    if ((want_lan)); then
      launchctl setenv OLLAMA_HOST "0.0.0.0:${SY_OMEN45L_OLLAMA_PORT:-11434}"
    fi
    echo ">> launchd session env updated. Run 'ollama_restart' for it to take effect."
    return 0
  fi

  if ((is_os_windows)); then
    echo "ollama_apply_daemon_env: this is WSL — set the variables on the Windows host instead." >&2
    echo "  Example (PowerShell): [Environment]::SetEnvironmentVariable('OLLAMA_CONTEXT_LENGTH','${OLLAMA_CONTEXT_LENGTH:-16384}','User')" >&2
    return 1
  fi

  if ! type -P systemctl > /dev/null 2>&1; then
    echo "ollama_apply_daemon_env: no systemd here — export the vars in whatever starts 'ollama serve'" >&2
    return 1
  fi

  local folder="/etc/systemd/system/ollama.service.d"
  local target="$folder/sy-bashrc.conf"
  local desired="[Service]"
  for var in $SY_OLLAMA_MANAGED_ENV_VARS; do
    eval "value=\${$var:-}"
    [ -n "$value" ] || continue
    desired="$desired
Environment=\"$var=$value\""
  done
  if ((want_lan)); then
    desired="$desired
Environment=\"OLLAMA_HOST=0.0.0.0:${SY_OMEN45L_OLLAMA_PORT:-11434}\""
  fi

  if [ -f "$target" ] && [ "$(command cat "$target" 2> /dev/null)" = "$desired" ]; then
    echo ">> Skipped: $target already up to date"
    return 0
  fi

  echo ">> writing $target"
  sudo mkdir -p "$folder"
  echo "$desired" | sudo tee "$target" > /dev/null
  sudo systemctl daemon-reload
  sudo systemctl restart ollama
  echo ">> ollama restarted with the managed environment"
}

# --- Diagnostics ---

# ollama_doctor: one-shot diagnosis for an Ollama endpoint that stalls or stops mid-answer
function ollama_doctor() {
  if is_help_arg "${1:-}"; then
    echo "ollama_doctor: diagnose an Ollama endpoint that hangs or truncates
  Usage: ollama_doctor [host[:port]]

Host defaults to 127.0.0.1:11434. Checks, in order:
  1. daemon reachable + version
  2. how many models are installed
  3. which models are resident, and whether any spilled out of VRAM
  4. the OLLAMA_* tuning this shell exports
  5. a live one-token generation, which separates 'daemon is wedged' from
     'the client gave up'

Common causes of a mid-answer stall, in the order worth checking:
  - context too small: the daemon's auto context lands near 4k, the agent's
    prompt is bigger, and the tail is dropped. Fix with ollama_apply_daemon_env.
  - model spilled to CPU: ollama_ps shows vram < size. Use a smaller quant.
  - model evicted between turns: raise \$OLLAMA_KEEP_ALIVE.
  - daemon wedged: ollama_unload, then ollama_restart."
    return 0
  fi

  local host
  host="$(_ollama_local_url "${1:-}")"
  echo "== ollama_doctor: $host =="

  local version
  version="$(command curl -fsS --max-time 5 "$host/api/version" 2> /dev/null)"
  if [ -z "$version" ]; then
    echo "[FAIL] unreachable — daemon down, wrong port, or firewalled"
    if ((is_os_windows)); then
      echo "       WSL talks to the Windows host daemon; confirm it is running there."
    else
      echo "       Try: ollama_restart"
    fi
    return 1
  fi
  echo "[ok]   reachable — $version"

  local model_count
  model_count="$(list_ollama_models "$host" 2> /dev/null | grep -c .)"
  echo "[ok]   ${model_count:-0} model(s) installed"

  echo "-- resident models --"
  ollama_ps "$host" 2> /dev/null || echo "(none)"

  echo "-- this shell's tuning (the daemon may differ — see ollama_apply_daemon_env) --"
  local var value
  for var in $SY_OLLAMA_MANAGED_ENV_VARS; do
    eval "value=\${$var:-<unset>}"
    echo "   $var=$value"
  done

  local probe_model
  probe_model="$(list_ollama_models "$host" 2> /dev/null | command head -n 1)"
  if [ -z "$probe_model" ]; then
    echo "[warn] no models installed — pull one, e.g. 'ollama pull qwen2.5-coder:7b'"
    return 0
  fi

  echo "-- live generation probe ($probe_model) --"
  if command curl -fsS --max-time 120 "$host/api/generate" \
    -H 'content-type: application/json' \
    -d "{\"model\":\"$probe_model\",\"prompt\":\"say ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" \
    > /dev/null 2>&1; then
    echo "[ok]   generation succeeded — the daemon is healthy"
  else
    echo "[FAIL] generation timed out or errored"
    echo "       Try, in order: ollama_unload / ollama_restart / a smaller model"
  fi
}
