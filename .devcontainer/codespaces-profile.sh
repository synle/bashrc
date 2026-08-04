#!/usr/bin/env bash

# Codespace-specific shell profile
# Add custom aliases and functions here that are only needed in Codespaces
# (as opposed to the shared configs from synle/bashrc)

alias apply='vim a.patch; git apply a.patch; rm a.patch; git add -u; git commit'
alias patch='apply'

# Clean up redundant dotfiles clone to save disk space.
# GitHub clones the dotfiles repo to this path when running install.sh,
# but the repo already exists at /workspaces/bashrc in this codespace.
rm -rf /workspaces/.codespaces/.persistedshare/dotfiles &>/dev/null
