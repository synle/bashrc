#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# vim-plug.sh — Installs the vim-plug plugin manager and runs :PlugInstall headless.
#
# vim-plug is a single autoload script at ~/.vim/autoload/plug.vim. Plugins declared in
# ~/.vimrc via Plug 'owner/repo' clone into ~/.vim/plugged/. The native `branch:` option
# means coc.nvim is fetched on its prebuilt `release` branch directly — no post-clone
# checkout hack needed.

PLUG_URL="https://raw.githubusercontent.com/junegunn/vim-plug/HEAD/plug.vim"
PLUG_DEST="$HOME/.vim/autoload/plug.vim"

echo ">> Installing vim-plug - $PLUG_URL"
safe_mkdir "$HOME/.vim/autoload"
curl -fsSL "$PLUG_URL" -o "$PLUG_DEST"

echo ">> Installing vim plugins via :PlugInstall (background)"
echo "   Manual fallback: vim -E -s -u ~/.vimrc +PlugInstall +qall"
(vim -E -s -u ~/.vimrc +PlugInstall +qall > /dev/null 2>&1) &
