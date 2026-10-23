#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# TODO: Remove this Docker Desktop uninstall script once fully ramped to OrbStack.
# Temporary macOS migration: remove the app and Homebrew-managed helpers, not VM data or ~/.docker.
# Homebrew may request administrator approval to unload privileged helpers.

if ! ((is_os_mac)); then
  echo ">> Docker Desktop uninstall >> Skipped (macOS only)"
  exit 0
fi

if [ ! -d "/Applications/Docker.app" ]; then
  echo ">> Docker Desktop uninstall >> Skipped (Docker.app absent)"
  exit 0
fi

if ! has_persistent_binary brew > /dev/null 2>&1; then
  echo "ERROR: Homebrew is required to uninstall Docker Desktop safely." >&2
  exit 1
fi

_docker_casks=$(brew list --cask) || exit 1
for _docker_cask in docker-desktop docker; do
  if printf "%s\n" "$_docker_casks" | grep -qxF "$_docker_cask"; then
    # No --zap: preserve containers, images, volumes, contexts, and registry configuration.
    run_native brew uninstall --cask "$_docker_cask" < /dev/null || exit 1
    echo ">> Docker Desktop uninstall >> Removed app; retained user data"
    exit 0
  fi
done

echo "ERROR: Docker.app is not Homebrew-managed. Uninstall it manually before rerunning setup; user data was not changed." >&2
exit 1
