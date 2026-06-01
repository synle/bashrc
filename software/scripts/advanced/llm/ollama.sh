#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install ollama - run large language models locally (https://ollama.com)
# Linux: official curl|sh installer (sets up systemd unit and pulls binary).
# macOS: handled by `installBrewPackageInBackground ollama` in mac/_full-setup.sh.
# Windows host: handled by `Ollama.Ollama` in windows/_winget-install.sh.

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

# Pull a small FIM-capable coding model so Zed's `edit_predictions` has a localhost
# autocomplete target. (VS Code has no native inline-completion API for custom
# endpoints — Copilot Chat handles only chat-side BYOK via chatLanguageModels.json.)
# Tiered by `is_system_desktop`
# to match the perf-env split in ollama.profile.bash:
#   - Laptop (battery present)  -> qwen2.5-coder:1.5b-base (~1 GB, ~1.5 GB VRAM)
#   - Desktop (no battery)      -> qwen2.5-coder:3b-base (~2 GB, ~3 GB VRAM)
# Both are the `-base` checkpoints (FIM tokens present); `-instruct` produces chatty
# replies and is wrong for inline completion. The model list here MUST stay in sync
# with AUTOCOMPLETE_MODELS in software/scripts/advanced/llm/llm-common.js — that's
# the discovery side; this is the install side.
#
# Skip if `ollama` isn't on PATH yet (install above may have set up only the systemd
# unit on a fresh box). Skip if the model is already pulled (avoids re-downloading
# multi-GB blobs on every run). Background daemon start is intentional — `ollama
# pull` will spawn the server itself if needed.
if type -P ollama > /dev/null 2>&1; then
  if ((is_system_desktop)); then
    _autocomplete_model="qwen2.5-coder:3b-base"
  else
    _autocomplete_model="qwen2.5-coder:1.5b-base"
  fi

  # `ollama list` prints `NAME ID SIZE MODIFIED` rows; grep the exact tag to avoid
  # matching a different size of the same family (e.g. `1.5b-base` vs `3b-base`).
  if ollama list 2> /dev/null | grep -q "^${_autocomplete_model}[[:space:]]"; then
    echo ">> Skipped ollama model pull: ${_autocomplete_model} already present"
  else
    echo ">> Pulling ${_autocomplete_model} (editor autocomplete)"
    ollama pull "$_autocomplete_model" > /dev/null
  fi
fi
