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
