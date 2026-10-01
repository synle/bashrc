#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# vim-plug.sh — TEMPORARY migration cleanup: removes a leftover vim-plug install.
#
# vim moved from vim-plug to vim-jetpack (see vim-jetpack.sh). This script now only
# deletes what vim-plug left behind: ~/.vim/autoload/plug.vim and the ~/.vim/plugged/
# plugin clones (re-downloadable, nothing user-authored lives there). Safe to run
# repeatedly — each path is skipped when already gone. Delete this script once every
# machine has run it and the vim-jetpack migration is complete.

# --- vim-plug cleanup ---
for _vim_plug_path in "$HOME/.vim/autoload/plug.vim" "$HOME/.vim/plugged"; do
	if [ -e "$_vim_plug_path" ]; then
		echo ">> Removing old vim-plug install - $_vim_plug_path"
		rm -rf "$_vim_plug_path"
	fi
done
unset _vim_plug_path

# --- Old vim-plug install (disabled; kept until the vim-jetpack migration is done) ---
# PLUG_URL="https://raw.githubusercontent.com/junegunn/vim-plug/HEAD/plug.vim"
# PLUG_DEST="$HOME/.vim/autoload/plug.vim"
#
# echo ">> Installing vim-plug - $PLUG_URL"
# safe_mkdir "$HOME/.vim/autoload"
# curl -fsSL "$PLUG_URL" -o "$PLUG_DEST"
#
# echo ">> Installing vim plugins via :PlugInstall"
# echo "   Manual fallback: vim -E -s -u ~/.vimrc +PlugInstall +qall"
# # Foreground (not `&`) — backgrounding made run.sh return before the 17 plugin
# # clones finished, leaving ~/.vim/plugged/ empty and colorscheme dracula missing.
# # Keep stderr visible per CLAUDE.md rule on standalone install commands.
# vim -E -s -u ~/.vimrc +PlugInstall +qall > /dev/null
