#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install ollama - run large language models locally (https://ollama.com)
# Linux: official curl|sh installer (sets up systemd unit and pulls binary).
# macOS: handled by `installBrewPackageInBackground ollama` in mac/_full-setup.sh.
# Windows host: handled by `Ollama.Ollama` in windows/_winget-install.sh.
#
# Wipe every pulled model (run by hand; frees the multi-GB blobs):
#   ollama list | awk 'NR > 1 { print $1 }' | xargs -n 1 ollama rm
# One model only:
#   ollama rm qwen2.5-coder:7b
# From WSL, drive the Windows host CLI (assumes Ollama is on the Windows PATH,
# which WSL appends by default; strip the CR that Windows output carries):
#   ollama.exe list | tr -d '\r' | awk 'NR > 1 { print $1 }' | xargs -n 1 ollama.exe rm
# Same via the HTTP API (works from WSL against the Windows host daemon):
#   curl -fsS http://127.0.0.1:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d '"' -f 4 \
#     | while IFS= read -r m; do curl -fsS -X DELETE http://127.0.0.1:11434/api/delete -d "{\"model\":\"$m\"}"; done

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

# Skip on Android/Termux — the upstream installer assumes glibc + systemd.
if ((is_os_android_termux)); then
	echo ">>> Skipped ollama: not supported on Termux"
	exit 0
fi

# --- GPU / VRAM gate ---
# Detect total VRAM (MiB) of the largest GPU. NVIDIA via nvidia-smi (also works
# inside WSL2 through /usr/lib/wsl/lib); AMD via amdgpu sysfs; macOS Apple Silicon
# via unified memory, counting only 2/3 of RAM since the GPU cannot claim it all
# and the OS + apps need the rest. Intel Macs have no usable GPU → skip. No GPU → skip.
# GPU present but VRAM unreadable → 0, which keeps the small VRAM default.
_has_gpu=0
_vram_mib=0
if type -P nvidia-smi >/dev/null 2>&1; then
	_has_gpu=1
	while IFS= read -r _line; do
		_line=$(echo "$_line" | tr -dc '0-9')
		[ -n "$_line" ] && [ "$_line" -gt "$_vram_mib" ] && _vram_mib=$_line
	done <<EOF_NVSMI
$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null)
EOF_NVSMI
fi
if ((is_os_mac)) && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ]; then
	_has_gpu=1
	_bytes=$(sysctl -n hw.memsize 2>/dev/null | tr -dc '0-9')
	[ -n "$_bytes" ] && _vram_mib=$((_bytes / 1024 / 1024 * 2 / 3))
fi
for _vram_file in /sys/class/drm/card*/device/mem_info_vram_total; do
	[ -r "$_vram_file" ] || continue
	_has_gpu=1
	_bytes=$(command cat "$_vram_file" 2>/dev/null | tr -dc '0-9')
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

# Install the binary — native Linux only. macOS installs it via Homebrew
# (`installBrewPackageInBackground ollama` in mac/_full-setup.sh); WSL uses the
# Windows host install (winget Ollama.Ollama in windows/_winget-install.sh).
if ((!is_os_mac && !is_os_windows)); then
	# Force refresh: remove the persistent binary if stale so the installer can re-run.
	if is_force_refresh_stale "/usr/local/bin/ollama"; then
		if has_persistent_binary ollama &>/dev/null; then
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
		curl -fsSL https://ollama.com/install.sh | sh >/dev/null
	fi
fi

# TODO: figure what to do with mac onboarding ollama
if ((is_os_mac)); then
	echo ">>> Skipped ollama model pull: macOS installs via Homebrew (mac/_full-setup.sh); model pull TBD"
	exit 0
fi

# --- Model pull (HTTP API) ---
# Pull the selected bucket through the daemon's REST API instead of the `ollama`
# CLI, so no binary lookup is needed — on WSL this reaches the Windows host install
# (winget Ollama.Ollama, OLLAMA_HOST=0.0.0.0:11434 set by windows/_full-setup.ps1.bash)
# through the WSL2 bridge. Skip when the daemon isn't reachable (fresh Linux install
# whose systemd unit hasn't started, or the Windows host app isn't running).
# `stream:false` makes curl block until the pull finishes; blobs are content-
# addressed, so a re-run skips finished layers and resumes partial ones.
# Zed's `edit_predictions` targets the autocomplete model on localhost; VS Code has
# no native inline-completion API for custom endpoints.
OLLAMA_API_URL="http://127.0.0.1:11434"
if ! curl -fsS --max-time 5 "$OLLAMA_API_URL/api/version" >/dev/null 2>&1; then
	echo ">>> Skipped ollama model pull: daemon not reachable at $OLLAMA_API_URL"
	exit 0
fi

# Pull every missing model in parallel, and detach the whole batch so run.sh
# doesn't block on multi-GB downloads. Each pull is its own background curl; the
# outer subshell `wait`s on them and logs one line per model. Progress + errors go
# to $_pull_log — tail it to watch. The daemon dedupes concurrent downloads of the
# same blob, so a second run.sh started mid-pull costs no extra bandwidth.
_pulled_models=$(curl -fsS --max-time 10 "$OLLAMA_API_URL/api/tags" 2>/dev/null)
_models_missing=()
for _model in "${OLLAMA_MODELS_TO_PULL[@]}"; do
	# /api/tags returns `{"models":[{"name":"<tag>",...}]}`; match the exact quoted
	# tag so one quant or size never suppresses another model in the same family.
	if echo "$_pulled_models" | grep -F -q "\"name\":\"${_model}\""; then
		echo ">> Skipped ollama model pull: ${_model} already present"
		continue
	fi
	_models_missing+=("$_model")
done

if [ "${#_models_missing[@]}" -eq 0 ]; then
	exit 0
fi

_pull_log="$BASHRC_TEMP_DIR/ollama-pull.log"
echo ">> Pulling ${#_models_missing[@]} ollama model(s) in background: ${_models_missing[*]}"
echo ">> Progress: tail -f \"$_pull_log\""
(
	for _model in "${_models_missing[@]}"; do
		(
			if curl -fsS -X POST "$OLLAMA_API_URL/api/pull" -d "{\"model\":\"${_model}\",\"stream\":false}" >/dev/null; then
				echo "$(date '+%H:%M:%S') done: ${_model}"
			else
				echo "$(date '+%H:%M:%S') FAILED: ${_model}"
			fi
		) &
	done
	wait
	echo "$(date '+%H:%M:%S') all ollama pulls finished"
) </dev/null >>"$_pull_log" 2>&1 &

# --- Legacy model pull (CLI) — replaced by the HTTP API block above ---
# # Pull the selected bucket. Skip if `ollama` isn't on PATH yet (install above may
# # have set up only the systemd unit; on macOS brew may still be installing it). Skip models already pulled to avoid
# # re-downloading multi-GB blobs. `ollama pull` spawns the server itself if needed.
# # Zed's `edit_predictions` targets the autocomplete model on localhost; VS Code has
# # no native inline-completion API for custom endpoints.
# if type -P ollama > /dev/null 2>&1; then
#   for _model in "${OLLAMA_MODELS_TO_PULL[@]}"; do
#     # `ollama list` prints `NAME ID SIZE MODIFIED` rows; match exact tags so one
#     # quant or size never suppresses another model in the same family.
#     if ollama list 2> /dev/null | grep -q "^${_model}[[:space:]]"; then
#       echo ">> Skipped ollama model pull: ${_model} already present"
#       continue
#     fi
#
#     echo ">> Pulling ${_model}"
#     ollama pull "$_model" > /dev/null
#   done
# fi
