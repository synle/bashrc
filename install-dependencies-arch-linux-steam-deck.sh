# Disable read-only mode
sudo btrfs property set -ts / ro false

# Setting up pacman
sudo pacman-key --init
sudo pacman-key --populate archlinux

# Download deps
sudo pacman -Syu fzf
sudo pacman -Syu jq
sudo pacman -Syu bat
