# bootstrap/dependencies/steamos.sh
# SteamOS dependencies - packages, config

installPackage() {
  echo "  >> $@"
  sudo pacman -Sy $@ &> /dev/null
}

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
  installPackage bat
  installPackage ddcutil
  installPackage i2c-tools
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
