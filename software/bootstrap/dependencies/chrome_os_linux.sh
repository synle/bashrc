# software/bootstrap/dependencies/chrome_os_linux.sh
# ChromeOS (Crostini) dependencies - apt-get packages

if [ "$is_os_chromeos" = "1" ]; then
  echo ">> Begin setting up dependencies/chrome_os_linux.sh"

  sudo apt-get update -y

  function installAptPackage() {
    if dpkg -s "$1" &>/dev/null; then
      echo ">> $@ > apt > already installed"
    elif sudo apt-get install -y --fix-missing $@ &> /dev/null; then
      echo ">> $@ > apt > installed"
    else
      echo ">> $@ > apt > failed to install"
    fi
  }

  echo '>> Installing packages with apt-get'

  # ---- Core tools ----
  installAptPackage curl
  installAptPackage git
  installAptPackage make
  installAptPackage python
  installAptPackage vim

  # ---- CLI utilities ----
  installAptPackage bat
  installAptPackage fzf
  installAptPackage pv
  installAptPackage entr
  installAptPackage tmux

  # ---- GUI apps ----
  installAptPackage libreoffice
  installAptPackage nautilus
  installAptPackage remmina
  installAptPackage terminator
  installAptPackage vlc
  function installSnapPackage() {
    if snap list "$1" &>/dev/null; then
      echo ">> $1 > snap > already installed"
    elif sudo snap install $@ &>/dev/null; then
      echo ">> $1 > snap > installed"
    else
      echo ">> $1 > snap > failed to install"
    fi
  }

  installSnapPackage postman

else
  echo ">> Skipped dependencies/chrome_os_linux.sh"
fi
