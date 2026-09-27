#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install ollama - run large language models locally (https://ollama.com)
# Linux: official curl|sh installer (sets up systemd unit and pulls binary).
# macOS: handled by `installBrewPackageInBackground ollama` in mac/_full-setup.sh.
# Windows host: handled by `Ollama.Ollama` in windows/_winget-install.sh.

# --- Model buckets ---
# Pull set picked by detected GPU VRAM (see gate below). Each bucket is one list;
# the trailing comment names the role. The autocomplete entry MUST stay in sync
# with AUTOCOMPLETE_MODELS in software/scripts/advanced/llm/llm-common.js — that is
# the discovery side, this is the install side. Use the FIM-capable `-base`
# checkpoint; `-instruct` produces chatty replies and is wrong for inline completion.
#
# Tiers are named by the VRAM they target. Thresholds are MiB; cards report a bit
# under the marketing size (24 GB → 24576, 12 GB → 12288), so the cut sits below.
#
# LARGE_VRAM: 24 GB+ (RTX 3090 / 4090 / 5090). Agent and vision are ~19 GB each and
# cannot co-reside in 32 GB, so Ollama swaps them by workload.
OLLAMA_MODELS_LARGE_VRAM=(
  "glm-4.7-flash:q4_K_M"  # agent / coding (~19 GB)
  "gemma4:26b"            # vision / OCR / image tagging (~19 GB)
  "qwen2.5-coder:3b-base" # autocomplete (FIM)
)
OLLAMA_LARGE_VRAM_MIN_MIB=24000
# MEDIUM_VRAM: 12-16 GB (RTX 3060 12 GB, 4070, 4080). Each model fits alone.
OLLAMA_MODELS_MEDIUM_VRAM=(
  "qwen2.5-coder:14b"     # agent / coding (~9 GB)
  "gemma3:12b"            # vision (~8 GB)
  "qwen2.5-coder:3b-base" # autocomplete (FIM, ~2 GB)
)
OLLAMA_MEDIUM_VRAM_MIN_MIB=12000
# SMALL_VRAM: <= 8 GB laptops, and the conservative fallback when VRAM is unknown.
OLLAMA_MODELS_SMALL_VRAM=(
  "qwen2.5-coder:7b"        # agent / coding (~4.7 GB)
  "gemma3:4b"               # vision (~3.3 GB)
  "qwen2.5-coder:1.5b-base" # autocomplete (FIM, ~1 GB)
)
# Default pull set; the VRAM gate below upgrades it when a bigger card is found.
OLLAMA_MODELS_TO_PULL=("${OLLAMA_MODELS_SMALL_VRAM[@]}")

# Skip in CI — install requires sudo + systemd, and pulling a daemon binary into a
# throwaway runner has no value (no GPU, no follow-on inference).
((IS_CI)) && {
  echo ">>> Skipped ollama: CI"
  exit 0
}

# Skip on macOS — brew formula in mac/_full-setup.sh already handles it.
if ((is_os_mac)); then
  echo ">>> Skipped ollama: macOS uses Homebrew (mac/_full-setup.sh)"
  exit 0
fi

# Skip on WSL — Windows host install (winget Ollama.Ollama) exposes the API on
# 127.0.0.1:11434 which WSL can hit through the WSL2 bridge.
if ((is_os_windows)); then
  echo ">>> Skipped ollama: WSL uses Windows host install (winget Ollama.Ollama)"
  exit 0
fi

# Skip on Android/Termux — the upstream installer assumes glibc + systemd.
if ((is_os_android_termux)); then
  echo ">>> Skipped ollama: not supported on Termux"
  exit 0
fi

# --- GPU / VRAM gate ---
# Detect total VRAM (MiB) of the largest GPU. NVIDIA via nvidia-smi (also works
# inside WSL2 through /usr/lib/wsl/lib); AMD via amdgpu sysfs. No GPU → skip.
# GPU present but VRAM unreadable → 0, which keeps the small VRAM default.
_has_gpu=0
_vram_mib=0
if type -P nvidia-smi > /dev/null 2>&1; then
  _has_gpu=1
  while IFS= read -r _line; do
    _line=$(echo "$_line" | tr -dc '0-9')
    [ -n "$_line" ] && [ "$_line" -gt "$_vram_mib" ] && _vram_mib=$_line
  done << EOF_NVSMI
$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2> /dev/null)
EOF_NVSMI
fi
for _vram_file in /sys/class/drm/card*/device/mem_info_vram_total; do
  [ -r "$_vram_file" ] || continue
  _has_gpu=1
  _bytes=$(command cat "$_vram_file" 2> /dev/null | tr -dc '0-9')
  [ -n "$_bytes" ] || continue
  _mib=$((_bytes / 1024 / 1024))
  [ "$_mib" -gt "$_vram_mib" ] && _vram_mib=$_mib
done

if ((!_has_gpu)); then
  echo ">>> Skipped ollama: no GPU detected"
  exit 0
fi

if [ "$_vram_mib" -ge "$OLLAMA_LARGE_VRAM_MIN_MIB" ]; then
  echo ">> ollama: ${_vram_mib} MiB VRAM → large VRAM models"
  OLLAMA_MODELS_TO_PULL=("${OLLAMA_MODELS_LARGE_VRAM[@]}")
elif [ "$_vram_mib" -ge "$OLLAMA_MEDIUM_VRAM_MIN_MIB" ]; then
  echo ">> ollama: ${_vram_mib} MiB VRAM → medium VRAM models"
  OLLAMA_MODELS_TO_PULL=("${OLLAMA_MODELS_MEDIUM_VRAM[@]}")
else
  echo ">> ollama: ${_vram_mib} MiB VRAM (0 = unknown) → small VRAM models"
fi

# Force refresh: remove the persistent binary if stale so the installer can re-run.
if is_force_refresh_stale "/usr/local/bin/ollama"; then
  if has_persistent_binary ollama &> /dev/null; then
    echo ">> Force refresh: removing ollama"
    sudo rm -f /usr/local/bin/ollama
  fi
fi

_bin=$(has_persistent_binary ollama)
if [ -n "$_bin" ]; then
  echo ">> Skipped ollama: already installed at $_bin"
else
  echo '>> Installing ollama'
  # Upstream installer is `sh`-only (it greps /etc/os-release with POSIX syntax).
  curl -fsSL https://ollama.com/install.sh | sh > /dev/null
fi

# Pull the selected bucket. Skip if `ollama` isn't on PATH yet (install above may
# have set up only the systemd unit). Skip models already pulled to avoid
# re-downloading multi-GB blobs. `ollama pull` spawns the server itself if needed.
# Zed's `edit_predictions` targets the autocomplete model on localhost; VS Code has
# no native inline-completion API for custom endpoints.
if type -P ollama > /dev/null 2>&1; then
  for _model in "${OLLAMA_MODELS_TO_PULL[@]}"; do
    # `ollama list` prints `NAME ID SIZE MODIFIED` rows; match exact tags so one
    # quant or size never suppresses another model in the same family.
    if ollama list 2> /dev/null | grep -q "^${_model}[[:space:]]"; then
      echo ">> Skipped ollama model pull: ${_model} already present"
      continue
    fi

    echo ">> Pulling ${_model}"
    ollama pull "$_model" > /dev/null
  done
fi
