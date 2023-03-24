#! /bin/sh

VUNDLE_URL="https://github.com/synle/vundle.git"
VUNDLE_DIR=~/.vim/bundle/Vundle.vim

echo "  >> Installing Vundle Binary - $VUNDLE_URL"
rm -rf  ~/.vim/bundle
mkdir -p ~/.vim/bundle

git clone $VUNDLE_URL $VUNDLE_DIR &> /dev/null;

echo '  >> Installing Vundle Plugins:'
echo '  :PluginInstall'
echo '  vim +PluginInstall +qall'
