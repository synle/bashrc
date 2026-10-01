#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# vim-jetpack.sh — Installs the vim-jetpack plugin manager and runs :JetpackSync headless.
#
# vim-jetpack is a single script at ~/.vim/pack/jetpack/opt/vim-jetpack/plugin/jetpack.vim.
# Plugins declared in ~/.vimrc via Jetpack 'owner/repo' install into ~/.vim/pack/jetpack/opt/.
# ~/.vimrc also self-bootstraps on first open; this script just does it up front, headless.

JETPACK_URL="https://raw.githubusercontent.com/tani/vim-jetpack/master/plugin/jetpack.vim"
JETPACK_DEST="$HOME/.vim/pack/jetpack/opt/vim-jetpack/plugin/jetpack.vim"

echo ">> Installing vim-jetpack - $JETPACK_URL"
safe_mkdir "$(dirname "$JETPACK_DEST")"
curl -fsSL "$JETPACK_URL" -o "$JETPACK_DEST"

echo ">> Installing vim plugins via :JetpackSync"
echo "   Manual fallback: vim -E -s -u ~/.vimrc +JetpackSync +qall"
# Foreground (not `&`) — backgrounding made run.sh return before the plugin
# clones finished, leaving the plugin folder empty and colorscheme codedark missing.
# Keep stderr visible per CLAUDE.md rule on standalone install commands.
vim -E -s -u ~/.vimrc +JetpackSync +qall > /dev/null
