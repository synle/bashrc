#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install ollama - run large language models locally (https://ollama.com)
# Linux: official curl|sh installer (sets up systemd unit and pulls binary).
# macOS: handled by `installBrewPackageInBackground ollama` in mac/_full-setup.sh.
# Windows host: handled by `Ollama.Ollama` in windows/_full-setup.ps1.bash.

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
