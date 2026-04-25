#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install terraform + tflint on Linux distros that don't ship them in the main
# repos (Ubuntu/Debian apt and Fedora/RHEL dnf). Other platforms use their
# package managers: brew (mac), pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms whose package manager already ships these tools.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  echo ">>> Skipped iac-tools: package manager already provides terraform + tflint"
  exit 0
fi

# Only run on Linux flavors that match the apt/dnf binary fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  echo ">>> Skipped iac-tools: unsupported platform"
  exit 0
fi

_arch=$(uname -m)
case "$_arch" in
  x86_64 | amd64) _gh_arch="amd64" ;;
  aarch64 | arm64) _gh_arch="arm64" ;;
  *)
    echo ">>> Skipped iac-tools: unsupported arch $_arch"
    exit 0
    ;;
esac

# ---- terraform (https://www.terraform.io) ----
# HashiCorp publishes signed zip archives at releases.hashicorp.com — no apt repo
# add needed. Resolve the latest stable version via the version-checkpoint API.
if is_force_refresh_stale "$HOME/.local/bin/terraform"; then
  echo ">> Force refresh: removing terraform"
  rm -f "$HOME/.local/bin/terraform"
fi
if has_persistent_binary terraform &> /dev/null; then
  echo ">> Skipped terraform: already installed at $(has_persistent_binary terraform)"
else
  echo '>> Installing terraform'
  _tf_version=$(curl -fsSL https://checkpoint-api.hashicorp.com/v1/check/terraform 2> /dev/null \
    | sed -nE 's/.*"current_version":"([^"]+)".*/\1/p')
  if [ -n "$_tf_version" ]; then
    _tf_url="https://releases.hashicorp.com/terraform/${_tf_version}/terraform_${_tf_version}_linux_${_gh_arch}.zip"
    _tf_tmp=$(mktemp -d)
    if curl -fsSL "$_tf_url" -o "$_tf_tmp/terraform.zip" \
      && unzip -q -o "$_tf_tmp/terraform.zip" -d "$_tf_tmp" \
      && install -m 755 "$_tf_tmp/terraform" "$HOME/.local/bin/terraform"; then
      echo ">> terraform ${_tf_version} installed to $HOME/.local/bin/terraform"
    else
      echo ">> terraform install failed"
    fi
    rm -rf "$_tf_tmp"
  else
    echo ">> terraform install skipped: could not resolve latest version"
  fi
fi

# ---- tflint (https://github.com/terraform-linters/tflint) ----
if is_force_refresh_stale "$HOME/.local/bin/tflint"; then
  echo ">> Force refresh: removing tflint"
  rm -f "$HOME/.local/bin/tflint"
fi
if has_persistent_binary tflint &> /dev/null; then
  echo ">> Skipped tflint: already installed at $(has_persistent_binary tflint)"
else
  echo '>> Installing tflint'
  # Upstream installer drops the binary into $TFLINT_INSTALL_PATH (default /usr/local/bin).
  # Override to ~/.local/bin so the install stays user-scoped (no sudo).
  TFLINT_INSTALL_PATH="$HOME/.local/bin" \
    curl -fsSL https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash > /dev/null
fi
