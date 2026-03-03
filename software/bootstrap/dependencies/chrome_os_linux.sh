# software/bootstrap/dependencies/chrome_os_linux.sh
# ChromeOS (Crostini) dependencies - apt-get packages

if [ "$is_os_chromeos" = "1" ]; then
  echo ">> Begin setting up dependencies/chrome_os_linux.sh"

  sudo apt-get update -y

  installPackage() {
    if dpkg -s "$1" &>/dev/null; then
      echo "  >> $@ (already installed)"
      return
    fi
    echo "  >> $@ (installing)"
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
  echo ">> Skipped dependencies/chrome_os_linux.sh"
fi
