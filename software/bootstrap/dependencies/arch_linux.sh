# software/bootstrap/dependencies/arch_linux.sh
# Arch Linux dependencies - packages, config

if [ "$is_os_arch_linux" = "1" ]; then
  echo ">> Begin setting up dependencies/arch_linux.sh"

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with pacman'
  function installPackage() {
    if pacman -Q "$1" &>/dev/null; then
      echo "  >> $@ (already installed)"
    elif sudo pacman -S --noconfirm $@ &> /dev/null; then
      echo "  >> $@ (installed)"
    else
      echo "  >> $@ (failed to install)"
    fi
  }

  # ---- Core tools ----
  installPackage curl
  installPackage git
  installPackage make
  installPackage vim

  # ---- CLI utilities ----
  installPackage bat
  installPackage fzf
  installPackage pv
  installPackage entr
  installPackage tmux

  # ---- Git extensions ----
  installPackage github-cli
  installPackage git-lfs

  # ---- OS-specific ----
  installPackage xz

else
  echo ">> Skipped dependencies/arch_linux.sh"
fi
