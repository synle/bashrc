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
  function installPackage() {
    if dpkg -s "$1" &>/dev/null; then
      echo "  >> $@ (already installed)"
    elif pkg install -y $@ &> /dev/null; then
      echo "  >> $@ (installed)"
    else
      echo "  >> $@ (failed to install)"
    fi
  }

  echo '>> Installing packages with pkg'

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

  # ---- OS-specific ----
  installPackage proot # needed for android termux fhd fixes
  installPackage nodejs
  installPackage perl
  installPackage tig
  installPackage tmux

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
