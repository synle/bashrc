# steam deck file system is immutable and will be removed after each update. This command is to open it up for write
# Disable read-only mode
sudo btrfs property set -ts / ro false

# Setting up pacman
sudo pacman-key --init
sudo pacman-key --populate archlinux

# Download deps
sudo pacman -Syu bat


# used for boot video
# https://steamdeckrepo.com
mkdir -p ~/.steam/root/config/uioverrides/movies/
