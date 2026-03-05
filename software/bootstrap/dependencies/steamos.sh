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
  function installPacmanPackage() {
    if pacman -Q "$1" &>/dev/null; then
      echo ">> $@ > pacman > already installed"
    elif sudo pacman -Sy $@ &> /dev/null; then
      echo ">> $@ > pacman > installed"
    else
      echo ">> $@ > pacman > failed to install"
    fi
  }

  # ---- Core tools ----
  installPacmanPackage curl
  installPacmanPackage git
  installPacmanPackage make
  installPacmanPackage vim

  # ---- CLI utilities ----
  installPacmanPackage bat
  installPacmanPackage fzf
  installPacmanPackage pv
  installPacmanPackage entr
  installPacmanPackage tmux

  # ---- Git extensions ----
  installPacmanPackage gh
  installPacmanPackage git-lfs

  # ---- OS-specific ----
  installPacmanPackage ddcutil
  installPacmanPackage i2c-tools
  installPacmanPackage xz

  echo '>> Done installPacmanPackage'

  ################################################################################
  # ---- Boot Video Directory ----
  ################################################################################
  # https://steamdeckrepo.com
  echo '>> Create the folder for boot video'
  mkdir -p ~/.steam/root/config/uioverrides/movies/

else
  echo ">> Skipped dependencies/steamos.sh"
fi
