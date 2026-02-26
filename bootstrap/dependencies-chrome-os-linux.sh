# bootstrap/dependencies-chrome-os-linux.sh
# ChromeOS (Crostini) dependencies - apt-get packages

if [ "$is_os_chromeos" = "1" ]; then
  echo ">> Begin setting up dependencies-chrome-os-linux.sh"

  sudo apt-get update -y

  sudo apt-get install -y \
    curl \
    git \
    libreoffice \
    make \
    nautilus \
    python \
    remmina \
    terminator \
    vim \
    vlc \
  && echo '> Done Installing Dependencies...'

else
  echo ">> Skipped dependencies-chrome-os-linux.sh"
fi
