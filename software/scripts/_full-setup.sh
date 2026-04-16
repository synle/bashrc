#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/_full-setup.sh
# Common dependencies - runs on all platforms before OS-specific deps (requires --setup)
# NOTE: Centralize all common mkdir, touch, chmod, and chown operations here.
# Do not scatter directory creation, file touches, or permission setup across individual scripts.

echo ">> Begin installing dependencies..."

if ! ((IS_CI)); then

  ################################################################################
  # ---- Git Email ----
  ################################################################################
  git_email="$(git config --global user.email 2> /dev/null || true)"
  if [ -z "$git_email" ]; then
    echo ">> Git email not configured"
    echo ">> Enter your git email:"
    read -r git_email < /dev/tty
    if [ -n "$git_email" ]; then
      git config --global user.email "$git_email"
      echo ">> Set git user.email to $git_email"
    else
      echo ">> Skipped: no git email provided"
    fi
  fi

  ################################################################################
  # ---- SSH Key Setup ----
  ################################################################################
  if [ ! -f "$HOME/.ssh/id_rsa" ] || [ ! -s "$HOME/.ssh/id_rsa" ]; then
    rm -f "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_rsa.pub"
    echo ">> SSH key not found (~/.ssh/id_rsa)"
    echo ">> Please add your SSH private key to ~/.ssh/id_rsa and public key to ~/.ssh/id_rsa.pub"
    echo ">> Have you added your SSH keys? (y/n)"
    read -r ssh_confirm < /dev/tty
    if [ "$ssh_confirm" = "y" ] || [ "$ssh_confirm" = "Y" ]; then
      echo ">> SSH keys added"
    else
      echo ">> Skipped: add your SSH keys manually later"
    fi
  fi

  ################################################################################
  # ---- Common Config Files ----
  ################################################################################
  touch "$HOME/.hushlogin" # suppress "Last login" banner in new terminal sessions
  touch "$HOME/.bash_profile"
  touch "$HOME/.bashrc"
  touch "$HOME/.gitconfig"
  touch "$HOME/.gitmessage"

  ################################################################################
  # ---- Common Directories ----
  ################################################################################
  echo ">> Creating common directories"
  mkdir -p "$HOME/.local/bin"
  mkdir -p "$HOME/.ssh/sockets"
  mkdir -p "$HOME/.vim/bundle"

  ################################################################################
  # ---- Permissions ----
  # Fix ownership on home directories that curl|bash installers or sudo may
  # have created as root. safe_chown skips paths that do not exist.
  ################################################################################
  echo ">> Setting permissions"
  safe_chown "$HOME/.bash_profile" "$HOME/.bashrc"
  safe_chown -R "$HOME/.bun"
  safe_chown -R "$HOME/.cargo"
  safe_chown -R "$HOME/.claude"
  safe_chown -R "$HOME/.config"
  safe_chown -R "$HOME/.deno"
  safe_chown -R "$HOME/.fzf"
  safe_chown -R "$HOME/.local"
  safe_chown -R "$HOME/.ssh"
  safe_chown -R "$HOME/.temporalio"
  safe_chown -R "$HOME/.tmux"
  safe_chown -R "$HOME/.venv"
  safe_chown -R "$HOME/.vim"
  safe_chmod 700 "$HOME/.ssh"
  safe_chmod 600 "$HOME/.ssh/config" "$HOME/.ssh/id_rsa"
  safe_chmod 644 "$HOME/.ssh/id_rsa.pub"

fi
