# bootstrap/dependencies/android_termux.sh
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
  installPackage() {
    echo "  >> $@"
    pkg install -y $@ &> /dev/null
  }

  installPackage proot # needed for android termux fhd fixes
  installPackage nodejs
  installPackage fzf
  installPackage vim
  installPackage git
  installPackage tig
  installPackage python
  installPackage bat
  installPackage perl
  installPackage curl
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
