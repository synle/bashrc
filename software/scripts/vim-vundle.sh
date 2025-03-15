#! /bin/sh

VUNDLE_URL="https://github.com/synle/vundle.git"
VUNDLE_DIR=~/.vim/bundle/Vundle.vim

echo "  >> Uninstalling Old Vundle Binary"
rm -rf  ~/.vim/bundle

echo "  >> Installing Vundle Binary - $VUNDLE_URL"
mkdir -p ~/.vim/bundle

git clone $VUNDLE_URL $VUNDLE_DIR &> /dev/null;

echo '  >> Installing Vundle Plugins: (might need to run this manually)'
echo '    vim +PluginInstall +qall'

vim +PluginInstall +qall &> /dev/null
