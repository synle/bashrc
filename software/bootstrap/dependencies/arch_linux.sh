# software/bootstrap/dependencies/arch_linux.sh
# Arch Linux dependencies - packages, config

function installPackage() {
  if pacman -Q "$1" &>/dev/null; then
    echo "  >> $@ (already installed)"
    return
  fi
  echo "  >> $@ (installing)"
  sudo pacman -S --noconfirm $@ &> /dev/null
}

if [ "$is_os_arch_linux" = "1" ]; then
  echo ">> Begin setting up dependencies/arch_linux.sh"

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with pacman'
  installPackage github-cli
  installPackage git-lfs
  installPackage xz

else
  echo ">> Skipped dependencies/arch_linux.sh"
fi
