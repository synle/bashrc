# software/bootstrap/dependencies/arch_linux.sh
# Arch Linux dependencies - packages, config

if [ "$is_os_arch_linux" = "1" ]; then
  echo ">> Begin setting up dependencies/arch_linux.sh"

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with pacman'
  function installPacmanPackage() {
    echo -n ">> $@ >> Installing with Pacman >> "
    if pacman -Q "$1" &>/dev/null; then
      echo "Skipped"
    elif sudo pacman -S --noconfirm $@ &> /dev/null; then
      echo "Success"
    else
      echo "Error"
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
  installPacmanPackage jq
  installPacmanPackage yq
  installPacmanPackage git-delta

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
      echo -n ">> $pkg_name >> Installing with Flatpak >> "
      if flatpak list --app | grep -q "$flatpak_id" &>/dev/null; then
        echo "Skipped"
      elif flatpak install -y flathub "$flatpak_id" &>/dev/null; then
        echo "Success"
      else
        echo "Error"
      fi
    }

    installFlatpakPackage postman com.getpostman.Postman
    installFlatpakPackage blender org.blender.Blender
  fi

else
  echo ">> Skipped dependencies/arch_linux.sh"
fi
