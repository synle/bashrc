##########################################################
# Arch Linux / Steam Deck Dependencies
##########################################################

# Steam Deck file system is immutable and will be removed after each update.
# This command opens it up for write.
echo '>> Make the partition readable (Steam Deck is immutable)'
sudo btrfs property set -ts / ro false

##########################################################
# Setting up pacman
##########################################################
echo '>> Setting up pacman to install stuffs'
sudo pacman-key --init
sudo pacman-key --populate archlinux

##########################################################
# Install Packages
##########################################################
function installPackage(){
  echo '>> pacman install'
  for packageName in "$@"
  do
      echo "$packageName"
  done

  sudo pacman -Sy $@
}
installPackage \
  bat \
  ddcutil \
  i2c-tools \
  && echo '>> Done installPackage'

##########################################################
# Boot Video Directory
##########################################################
# https://steamdeckrepo.com
echo '>> Create the folder for boot video'
mkdir -p ~/.steam/root/config/uioverrides/movies/
