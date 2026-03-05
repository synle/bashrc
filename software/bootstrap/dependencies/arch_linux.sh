# software/bootstrap/dependencies/arch_linux.sh
# Arch Linux dependencies - packages, config

if [ "$is_os_arch_linux" = "1" ]; then
  echo ">> Begin setting up dependencies/arch_linux.sh"

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with pacman'
  function installPacmanPackage() {
    if pacman -Q "$1" &>/dev/null; then
      echo ">> $@ > pacman > already installed"
    elif sudo pacman -S --noconfirm $@ &> /dev/null; then
      echo ">> $@ > pacman > installed"
    else
      echo ">> $@ > pacman > failed to install"
    fi
  }

  # ---- Core tools ----
  installPacmanPackage curl
  installPacmanPackage git
  installPacmanPackage make
  installPacmanPackage vim

  # ---- CLI utilities ----
  installPacmanPackage bat
  installPacmanPackage fzf
  installPacmanPackage ripgrep
  installPacmanPackage pv
  installPacmanPackage entr
  installPacmanPackage tmux

  # ---- Git extensions ----
  installPacmanPackage github-cli
  installPacmanPackage git-lfs

  # ---- OS-specific ----
  installPacmanPackage xz

  # ---- GUI apps (only if a display server is available) ----
  if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    echo '>> Installing GUI apps'
    function installFlatpakPackage() {
      local pkg_name="$1"
      local flatpak_id="$2"
      if flatpak list --app | grep -q "$flatpak_id" &>/dev/null; then
        echo ">> $pkg_name > flatpak > already installed"
      elif flatpak install -y flathub "$flatpak_id" &>/dev/null; then
        echo ">> $pkg_name > flatpak > installed"
      else
        echo ">> $pkg_name > flatpak > failed to install"
      fi
    }

    installFlatpakPackage postman com.getpostman.Postman
    installFlatpakPackage blender org.blender.Blender
  fi

else
  echo ">> Skipped dependencies/arch_linux.sh"
fi
