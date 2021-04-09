#! /bin/sh

echo '  >> Installing Vundle Binary'
mkdir -p ~/.vim/bundle
VUNDLE_DIR=~/.vim/bundle/Vundle.vim
rm -rf $VUNDLE_DIR;
git clone https://github.com/VundleVim/Vundle.vim.git $VUNDLE_DIR &> /dev/null;

echo '  >> Installing Vundle Plugins:'
echo '  vim +PluginInstall +qall'
vim +PluginInstall +qall &>/dev/null;
