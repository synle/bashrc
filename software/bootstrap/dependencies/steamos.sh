# software/bootstrap/dependencies/steamos.sh
# SteamOS dependencies - packages, config

if [ "$is_os_steamos" = "1" ]; then
  echo ">> Begin setting up dependencies/steamos.sh"

  # Steam Deck file system is immutable and will be removed after each update.
  # This command opens it up for write.
  echo '>> Make the partition readable (Steam Deck is immutable)'
  sudo btrfs property set -ts / ro false

  ################################################################################
  # ---- Setting up pacman ----
  ################################################################################
  echo '>> Setting up pacman to install stuffs'
  sudo pacman-key --init
  sudo pacman-key --populate archlinux

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with pacman'
  function installPackage() {
    if pacman -Q "$1" &>/dev/null; then
      echo "  >> $@ (already installed)"
      return
    fi
    echo "  >> $@ (installing)"
    if sudo pacman -Sy $@ &> /dev/null; then
      echo "  >> $@ (done)"
    else
      echo "  >> $@ (failed to install)"
    fi
  }

  # ---- Core tools ----
  installPackage curl
  installPackage git
  installPackage make
  installPackage vim

  # ---- CLI utilities ----
  installPackage bat
  installPackage fzf
  installPackage pv
  installPackage entr

  # ---- Git extensions ----
  installPackage gh
  installPackage git-lfs

  # ---- OS-specific ----
  installPackage ddcutil
  installPackage i2c-tools
  installPackage xz

  echo '>> Done installPackage'

  ################################################################################
  # ---- Boot Video Directory ----
  ################################################################################
  # https://steamdeckrepo.com
  echo '>> Create the folder for boot video'
  mkdir -p ~/.steam/root/config/uioverrides/movies/

else
  echo ">> Skipped dependencies/steamos.sh"
fi
