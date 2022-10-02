# Setting up your steam deck
- https://www.reddit.com/r/SteamDeck/comments/t8al0i/install_arch_packages_on_your_steam_deck/

```bash

## Set passwords
passwd

## Downloading fonts - Cascadia and FiraCode
curl https://github.com/synle/bashrc/raw/master/fonts/CascadiaCode.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/CascadiaCodePL.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/CascadiaMono.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/CascadiaMonoPL.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Bold.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Light.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Medium.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Regular.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Retina.ttf -O -J -L && \
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-SemiBold.ttf -O -J -L && \
echo "Done downloading fonts"

## Disable read only mode: To allow adding new software
sudo btrfs property set -ts / ro false

## Setting up pacman (package manager)
sudo pacman-key --init
sudo pacman-key --populate archlinux

## Install dependencies
sudo pacman -Syu fzf
sudo pacman -Syu jq
sudo pacman -Syu bat

## install nvm / node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
nvm install 14
echo 'making sure we do "--no-use"'

## npm / yarn and other dependencies for node
npm install --global yarn

## symlink for node, npm and yarn
sudo ln -s /home/deck/.nvm/versions/node/v14*/bin/node /usr/bin/node
sudo ln -s /home/deck/.nvm/versions/node/v14*/bin/npm /usr/bin/npm
sudo ln -s /home/deck/.nvm/versions/node/v14*/bin/yarn /usr/bin/yarn

## git config
curl https://raw.githubusercontent.com/synle/bashrc/master/.build/gitconfig -o ~/.gitconfig

## vimrc and vundle
git clone https://github.com/VundleVim/Vundle.vim.git ~/.vim/bundle/Vundle.vim
curl https://raw.githubusercontent.com/synle/bashrc/master/.build/vimrc -o ~/.vimrc

## input rc
curl https://raw.githubusercontent.com/synle/bashrc/master/.build/inputrc -o ~/.inputrc

## other stuffs
sudo echo '> Initializing Environment' && \
echo """
export is_os_darwin_mac='0'
export is_os_window='0'
export is_os_wsl='0'
export is_os_ubuntu='0'
export is_os_chromeos='0'
export is_os_mingw64='0'
export is_os_android_termux='0'
export is_os_arch_linux='1'
""" > ~/.bash_syle_os && source ~/.bash_syle_os
```
