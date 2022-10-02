# Setting up your steam deck

- https://www.reddit.com/r/SteamDeck/comments/t8al0i/install_arch_packages_on_your_steam_deck/

```bash

## Set passwords
passwd

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
```
