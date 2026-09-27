#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install ollama - run large language models locally (https://ollama.com)
# Native Linux only: official curl|sh installer (sets up systemd unit + binary).
# macOS: `installBrewPackageInBackground ollama` in mac/_full-setup.sh.
# WSL / Windows host: `Ollama.Ollama` in windows/_winget-install.sh.
#
# Model pulls live in ollama-models.js; the model inventory lives in
# llm-models.jsonc (OLLAMA_MODELS_BY_VRAM in llm-common.js).

# Skip in CI — install requires sudo + systemd, and a daemon binary on a throwaway
# runner has no value (no GPU, no follow-on inference).
((IS_CI)) && {
	echo ">>> Skipped ollama: CI"
	exit 0
}

if ((is_os_mac)); then
	echo ">>> Skipped ollama: macOS installs via Homebrew (mac/_full-setup.sh)"
	exit 0
fi

if ((is_os_windows)); then
	echo ">>> Skipped ollama: WSL uses the Windows host install (winget Ollama.Ollama)"
	exit 0
fi

# Skip on Android/Termux — the upstream installer assumes glibc + systemd.
if ((is_os_android_termux)); then
	echo ">>> Skipped ollama: not supported on Termux"
	exit 0
fi

# No GPU → nothing worth serving locally (is_system_gpu from common-env.sh).
if ((!is_system_gpu)); then
	echo ">>> Skipped ollama: no GPU detected"
	exit 0
fi

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
