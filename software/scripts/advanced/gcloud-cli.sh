#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install gcloud (Google Cloud CLI) on Linux distros that don't ship it in the
# main repos (Ubuntu/Debian apt and Fedora/RHEL dnf — both require Google's
# external repo). Other platforms use their package managers: brew (mac),
# pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms whose package manager already provides gcloud.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  echo ">>> Skipped gcloud-cli: package manager already provides google-cloud-cli"
  exit 0
fi

# Only run on Linux flavors that match the official tarball fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  echo ">>> Skipped gcloud-cli: unsupported platform"
  exit 0
fi

_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _gcloud_arch="x86_64" ;;
aarch64 | arm64) _gcloud_arch="arm" ;;
*)
  echo ">>> Skipped gcloud-cli: unsupported arch $_arch"
  exit 0
  ;;
esac

_gcloud_dir="$HOME/google-cloud-sdk"

# Force refresh: remove existing user-scoped install if stale.
if is_force_refresh_stale "$HOME/.local/bin/gcloud"; then
  echo ">> Force refresh: removing google-cloud-sdk"
  rm -rf "$_gcloud_dir" "$HOME/.local/bin/gcloud" "$HOME/.local/bin/gsutil" "$HOME/.local/bin/bq"
fi

# Skip if gcloud is already installed.
if has_persistent_binary gcloud &> /dev/null; then
  echo ">> Skipped gcloud-cli: already installed at $(has_persistent_binary gcloud)"
  exit 0
fi

echo '>> Installing google-cloud-sdk'
# Official archive install (https://cloud.google.com/sdk/docs/install#linux). Userspace —
# extracts to $HOME/google-cloud-sdk, then symlinks gcloud/gsutil/bq into ~/.local/bin so
# they resolve on PATH without modifying the shell profile.
_gcloud_url="https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-${_gcloud_arch}.tar.gz"
if curl -fsSL "$_gcloud_url" | tar -xz -C "$HOME" \
  && "$_gcloud_dir/install.sh" --quiet --path-update=false --usage-reporting=false --command-completion=false > /dev/null; then
  safe_mkdir "$HOME/.local/bin"
  ln -sf "$_gcloud_dir/bin/gcloud" "$HOME/.local/bin/gcloud"
  ln -sf "$_gcloud_dir/bin/gsutil" "$HOME/.local/bin/gsutil"
  ln -sf "$_gcloud_dir/bin/bq" "$HOME/.local/bin/bq"
  echo ">> google-cloud-sdk installed to $_gcloud_dir (symlinks in $HOME/.local/bin)"
else
  echo ">> google-cloud-sdk install failed"
fi
