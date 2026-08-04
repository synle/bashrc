# Ollama performance env vars — tuned per platform
# SOURCE | software/bootstrap/common-functions.bash

if ((is_system_desktop)); then
  # Desktop — more GPU headroom, higher parallel + precision
  export OLLAMA_FLASH_ATTENTION=1
  export OLLAMA_NUM_PARALLEL=4
  export OLLAMA_KV_CACHE_TYPE=q8_0
else
  # Laptop — conserve VRAM, lower parallel + precision
  export OLLAMA_FLASH_ATTENTION=1
  export OLLAMA_NUM_PARALLEL=2
  export OLLAMA_KV_CACHE_TYPE=q4_0
fi

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
