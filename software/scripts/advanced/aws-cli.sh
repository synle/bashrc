#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install aws-cli (`aws`) v2 on Linux distros that don't ship a current build in
# the main repos (Ubuntu/Debian apt has v1 deprecated, Fedora/RHEL dnf is split
# across versions). Other platforms use their package managers: brew (mac),
# pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms whose package manager already provides aws-cli v2.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  echo ">>> Skipped aws-cli: package manager already provides aws-cli"
  exit 0
fi

# Only run on Linux flavors that match the official installer fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  echo ">>> Skipped aws-cli: unsupported platform"
  exit 0
fi

_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _aws_arch="x86_64" ;;
aarch64 | arm64) _aws_arch="aarch64" ;;
*)
  echo ">>> Skipped aws-cli: unsupported arch $_arch"
  exit 0
  ;;
esac

# Force refresh: remove existing user-scoped install if stale.
if is_force_refresh_stale "$HOME/.local/bin/aws"; then
  echo ">> Force refresh: removing aws-cli"
  rm -rf "$HOME/.local/aws-cli" "$HOME/.local/bin/aws" "$HOME/.local/bin/aws_completer"
fi

# Skip if aws is already installed.
if has_persistent_binary aws &> /dev/null; then
  echo ">> Skipped aws-cli: already installed at $(has_persistent_binary aws)"
  exit 0
fi

echo '>> Installing aws-cli v2'
# Official AWS CLI v2 installer (https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
# Userspace install: --install-dir + --bin-dir keep everything under $HOME/.local (no sudo).
_aws_url="https://awscli.amazonaws.com/awscli-exe-linux-${_aws_arch}.zip"
_aws_tmp=$(mktemp -d)
if curl -fsSL "$_aws_url" -o "$_aws_tmp/awscliv2.zip" \
  && unzip -q -o "$_aws_tmp/awscliv2.zip" -d "$_aws_tmp" \
  && "$_aws_tmp/aws/install" -i "$HOME/.local/aws-cli" -b "$HOME/.local/bin" > /dev/null; then
  echo ">> aws-cli installed to $HOME/.local/bin/aws"
else
  echo ">> aws-cli install failed"
fi
rm -rf "$_aws_tmp"
