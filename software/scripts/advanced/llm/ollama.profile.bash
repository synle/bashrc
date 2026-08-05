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
export SY_OMEN45L_OLLAMA_DEFAULT_MODEL="gemma4:26b"

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

  local env_ip="${SY_OMEN45L_IP:-127.0.0.1}"
  local env_port="${SY_OMEN45L_OLLAMA_PORT:-11434}"
  local default_host="${env_ip}:${env_port}"
  local host="${1:-$default_host}"

  # Normalize the host into a full URL: keep an explicit scheme, add the default port
  # when the caller omitted one, and assume http:// for a bare host.
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

  # Progress goes to stderr so the model list on stdout stays pipe-clean.
  echo "Fetching models from $host..." >&2
  curl -s "$host/api/tags" | grep -o '"name": *"[^"]*"' | cut -d'"' -f4
}
