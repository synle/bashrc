# software/bootstrap/dependencies/chrome_os_linux.sh
# ChromeOS (Crostini) dependencies - apt-get packages

if [ "$is_os_chromeos" = "1" ]; then
  echo ">> Begin setting up dependencies/chrome_os_linux.sh"

  sudo apt-get update -y

  function installAptPackage() {
    echo -n ">> $@ >> Installing with Apt >> "
    if dpkg -s "$1" &>/dev/null; then
      echo "Skipped"
    elif sudo apt-get install -y --fix-missing $@ &> /dev/null; then
      echo "Success"
    else
      echo "Error"
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
  installAptPackage ripgrep
  installAptPackage pv
  installAptPackage entr
  installAptPackage tmux
  installAptPackage jq
  installAptPackage yq
  installAptPackage git-delta
  installAptPackage zoxide
  installAptPackage eza
  installAptPackage fd-find
  installAptPackage tree

  # ---- Dev tools / Build ----
  installAptPackage gradle
  installAptPackage rustc
  installAptPackage golang-go

  # ---- GUI apps ----
  installAptPackage libreoffice
  installAptPackage nautilus
  installAptPackage remmina
  installAptPackage terminator
  installAptPackage vlc
  function installSnapPackage() {
    echo -n ">> $1 >> Installing with Snap >> "
    if snap list "$1" &>/dev/null; then
      echo "Skipped"
    elif sudo snap install $@ &>/dev/null; then
      echo "Success"
    else
      echo "Error"
    fi
  }

  installSnapPackage postman
  installSnapPackage blender --classic

else
  echo ">> Skipped dependencies/chrome_os_linux.sh"
fi
