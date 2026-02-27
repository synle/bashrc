# bootstrap/dependencies-chrome-os-linux.sh
# ChromeOS (Crostini) dependencies - apt-get packages

if [ "$is_os_chromeos" = "1" ]; then
  echo ">> Begin setting up dependencies-chrome-os-linux.sh"

  sudo apt-get update -y

  installPackage() {
    echo "  >> $@"
    sudo apt-get install -y --fix-missing $@ &> /dev/null
  }

  installPackage curl
  installPackage git
  installPackage libreoffice
  installPackage make
  installPackage nautilus
  installPackage python
  installPackage remmina
  installPackage terminator
  installPackage vim
  installPackage vlc

else
  echo ">> Skipped dependencies-chrome-os-linux.sh"
fi
