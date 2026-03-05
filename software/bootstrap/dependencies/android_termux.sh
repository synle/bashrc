# software/bootstrap/dependencies/android_termux.sh
# Android Termux dependencies - packages, theme, config

if [ "$is_os_android_termux" = "1" ]; then
  echo ">> Begin setting up dependencies/android_termux.sh"

  # this override the content
  echo '''
# chroot to set up /tmp /etc and other fds for linux
termux-chroot
''' > "$BASH_SYLE_PATH"

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  function installPkgPackage() {
    echo -n ">> $@ >> Installing with Pkg >> "
    if dpkg -s "$1" &>/dev/null; then
      echo "Skipped"
    elif pkg install -y $@ &> /dev/null; then
      echo "Success"
    else
      echo "Error"
    fi
  }

  echo '>> Installing packages with pkg'

  # ---- Core tools ----
  installPkgPackage curl
  installPkgPackage git
  installPkgPackage make
  installPkgPackage python
  installPkgPackage vim

  # ---- CLI utilities ----
  installPkgPackage bat
  installPkgPackage fzf
  installPkgPackage ripgrep
  installPkgPackage pv
  installPkgPackage entr
  installPkgPackage jq
  installPkgPackage yq
  installPkgPackage git-delta

  # ---- OS-specific ----
  installPkgPackage proot # needed for android termux fhd fixes
  installPkgPackage nodejs
  installPkgPackage perl
  installPkgPackage tig
  installPkgPackage tmux

  ################################################################################
  # ---- Update and Clean ----
  ################################################################################
  pkg update -y
  pkg upgrade -y
  pkg autoclean -y

  source "$BASH_SYLE_PATH"

else
  echo ">> Skipped dependencies/android_termux.sh"
fi
