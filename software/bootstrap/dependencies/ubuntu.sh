# software/bootstrap/dependencies/ubuntu.sh
# Ubuntu / Debian dependencies - apt-get packages and user permissions

if [ "$is_os_ubuntu" = "1" ]; then
  echo ">> Begin setting up dependencies/ubuntu.sh"

  echo '>> update packages'
  sudo apt-get update -y &> /dev/null

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with apt-get'
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
  installAptPackage net-tools
  installAptPackage jq
  installAptPackage yq
  installAptPackage git-delta
  installAptPackage zoxide
  installAptPackage eza
  installAptPackage fd-find
  installAptPackage tree

  # ---- Dev tools / Build ----
  installAptPackage gradle
  installAptPackage default-jdk
  installAptPackage unzip
  installAptPackage gnupg
  installAptPackage software-properties-common
  installAptPackage build-essential

  # ---- Git extensions ----
  installAptPackage gh
  installAptPackage git-lfs

  # ---- OS-specific ----
  installAptPackage openssh-server
  installAptPackage xz-utils

  # ---- GUI apps (only if a display server is available) ----
  if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    echo '>> Installing GUI apps'
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
  fi

  ################################################################################
  # ---- User Permissions ----
  ################################################################################
  echo '>> Setting up user permissions'
  sudo usermod -aG input ${USER}
  sudo usermod -aG video ${USER}

else
  echo ">> Skipped dependencies/ubuntu.sh"
fi
