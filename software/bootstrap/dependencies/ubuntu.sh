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
  function installPackage() {
    if dpkg -s "$1" &>/dev/null; then
      echo "  >> $@ (already installed)"
    elif sudo apt-get install -y --fix-missing $@ &> /dev/null; then
      echo "  >> $@ (installed)"
    else
      echo "  >> $@ (failed to install)"
    fi
  }

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
  installPackage net-tools

  # ---- Dev tools / Build ----
  installPackage default-jdk
  installPackage unzip
  installPackage gnupg
  installPackage software-properties-common
  installPackage build-essential

  # ---- Git extensions ----
  installPackage gh
  installPackage git-lfs

  # ---- OS-specific ----
  installPackage openssh-server
  installPackage xz-utils

  ################################################################################
  # ---- User Permissions ----
  ################################################################################
  echo '>> Setting up user permissions'
  sudo usermod -aG input ${USER}
  sudo usermod -aG video ${USER}

else
  echo ">> Skipped dependencies/ubuntu.sh"
fi
