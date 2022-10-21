# steam deck file system is immutable and will be removed after each update. This command is to open it up for write
# Disable read-only mode
echo '>> Make the partition readable (Steam Deck is immutable)'
sudo btrfs property set -ts / ro false

# Setting up pacman
echo '>> Setting up pacman to install stuffs'
sudo pacman-key --init
sudo pacman-key --populate archlinux

# Download deps
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
  ddcutil \ # brightness https://moverest.xyz/blog/control-display-with-ddc-ci/
  i2c-tools \
  && echo '>> Done installPackage'

# used for boot video
# https://steamdeckrepo.com
echo '>> Create the folder for boot video'
mkdir -p ~/.steam/root/config/uioverrides/movies/
