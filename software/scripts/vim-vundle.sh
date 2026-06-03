#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

VUNDLE_URL="https://github.com/synle/vundle.git"
VUNDLE_DIR=~/.vim/bundle/Vundle.vim

echo ">> Uninstalling Old Vundle Binary"
rm -rf ~/.vim/bundle

echo ">> Installing Vundle Binary - $VUNDLE_URL"
safe_mkdir "$HOME/.vim/bundle"

git clone $VUNDLE_URL $VUNDLE_DIR > /dev/null

echo '>> Installing Vundle Plugins: (might need to run this manually)'
echo '    vim -E -s -u ~/.vimrc +PluginInstall +qall'
# Run PluginInstall in a background subshell and chain the coc.nvim release-branch fix
# AFTER it completes. Vundle ignores the `'branch': 'release'` Plugin option (vim-plug syntax),
# so coc.nvim gets cloned on master, which has no prebuilt build/index.js — vim then errors:
# "[coc.nvim] build/index.js not found, please install dependencies and compile coc.nvim by: npm ci".
# Doing the checkout HERE (inside the same subshell, after PluginInstall) closes the race window
# where a sibling script (e.g. vim-coc.sh) ran the same fix but saw an empty bundle dir because
# the background clone had not finished yet.
(
  vim -E -s -u ~/.vimrc +PluginInstall +qall > /dev/null 2>&1
  _coc_plugin_folder="$HOME/.vim/bundle/coc.nvim"
  if [ -d "$_coc_plugin_folder/.git" ]; then
    git -C "$_coc_plugin_folder" fetch origin release > /dev/null 2>&1
    git -C "$_coc_plugin_folder" checkout release > /dev/null 2>&1
    git -C "$_coc_plugin_folder" reset --hard origin/release > /dev/null 2>&1
  fi
) &
