# Arch Linux / Steam Deck Notes

## Setting Up Steam Deck

Reference: <https://www.reddit.com/r/SteamDeck/comments/t8al0i/install_arch_packages_on_your_steam_deck/>

### Initial Setup

```bash
# Set password
passwd

# Steam Deck file system is immutable and resets after each update.
# Disable read only mode to allow adding new software.
sudo btrfs property set -ts / ro false
```

### Package Manager (pacman)

```bash
sudo pacman-key --init
sudo pacman-key --populate archlinux

sudo pacman -Syu fzf
sudo pacman -Syu bat
```

### Install Node.js via NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
DEFAULT_NVM_NODE_VERSION=21
nvm install $DEFAULT_NVM_NODE_VERSION

npm install --global yarn
```
