# software/bootstrap/dependencies/ubuntu.sh
# Ubuntu / Debian dependencies - apt-get packages and user permissions

if [ "$is_os_ubuntu" = "1" ]; then
  echo ">> Begin setting up dependencies/ubuntu.sh"
  sudo -v

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
  installAptPackage prettyping

  # ---- Dev tools / Build ----
  installAptPackage gradle
  installAptPackage rustc
  installAptPackage golang-go
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

  # ---- VSCodium (deb install, non-WSL only) ----
  if [ "$is_os_windows" != "1" ]; then
    echo -n ">> vscodium >> Installing with dpkg >> "
    if command -v codium &>/dev/null; then
      echo "Skipped"
    else
      vscodium_version=$(curl -s https://api.github.com/repos/VSCodium/vscodium/releases/latest \
        | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>console.log(JSON.parse(b).tag_name))")
      vscodium_file="codium_${vscodium_version}_amd64.deb"
      vscodium_url="https://github.com/VSCodium/vscodium/releases/download/${vscodium_version}/${vscodium_file}"
      pushd /tmp >/dev/null || true
      wget -q "$vscodium_url" -O "$vscodium_file"
      if sudo dpkg -i "$vscodium_file" >/dev/null 2>&1 || sudo apt -f install -y >/dev/null 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
      rm -f "$vscodium_file"
      popd >/dev/null || true
    fi
  fi

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
