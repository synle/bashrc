# Arch Linux / SteamOS Notes

## Setting Up SteamOS

Reference: <https://www.reddit.com/r/SteamDeck/comments/t8al0i/install_arch_packages_on_your_steam_deck/>

### Initial Setup

```bash
# Set password
passwd

# SteamOS file system is immutable and resets after each update.
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

### Install Node.js via fnm

```bash
curl -fsSL https://fnm.vercel.app/install | bash
DEFAULT_FNM_NODE_VERSION=24
fnm install $DEFAULT_FNM_NODE_VERSION

npm install --global yarn
```
