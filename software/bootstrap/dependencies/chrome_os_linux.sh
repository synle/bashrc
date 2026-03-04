# software/bootstrap/dependencies/chrome_os_linux.sh
# ChromeOS (Crostini) dependencies - apt-get packages

if [ "$is_os_chromeos" = "1" ]; then
  echo ">> Begin setting up dependencies/chrome_os_linux.sh"

  sudo apt-get update -y

  function installPackage() {
    if dpkg -s "$1" &>/dev/null; then
      echo "  >> $@ (already installed)"
    elif sudo apt-get install -y --fix-missing $@ &> /dev/null; then
      echo "  >> $@ (installed)"
    else
      echo "  >> $@ (failed to install)"
    fi
  }

  echo '>> Installing packages with apt-get'

  # ---- Core tools ----
  installPackage curl
  installPackage git
  installPackage make
  installPackage python
  installPackage vim

  # ---- CLI utilities ----
  installPackage bat
  installPackage fzf
  installPackage pv
  installPackage entr

  # ---- OS-specific ----
  installPackage libreoffice
  installPackage nautilus
  installPackage remmina
  installPackage terminator
  installPackage vlc

else
  echo ">> Skipped dependencies/chrome_os_linux.sh"
fi
