#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install kubectl - Kubernetes command-line tool (https://kubernetes.io/docs/tasks/tools/)

# Force refresh: remove existing binary if stale
if is_force_refresh_stale "$HOME/.local/bin/kubectl"; then
  echo ">> Force refresh: removing kubectl"
  rm -f "$HOME/.local/bin/kubectl"
fi

# Install kubectl if not already installed
_bin=$(has_persistent_binary kubectl)
if [ -n "$_bin" ]; then
  echo ">> Skipped kubectl: already installed at $_bin"
else
  echo '>> Installing kubectl'
  KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
  KUBECTL_OS="linux"
  KUBECTL_ARCH="amd64"

  if [ "$(uname -s)" = "Darwin" ]; then
    KUBECTL_OS="darwin"
  fi

  if [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "arm64" ]; then
    KUBECTL_ARCH="arm64"
  fi

  curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/${KUBECTL_OS}/${KUBECTL_ARCH}/kubectl" -o "$HOME/.local/bin/kubectl"
  chmod +x "$HOME/.local/bin/kubectl"
  echo ">> kubectl ${KUBECTL_VERSION} installed to $HOME/.local/bin/kubectl"
fi
