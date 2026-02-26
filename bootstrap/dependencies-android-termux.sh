# bootstrap/dependencies-android-termux.sh
# Android Termux dependencies - packages, theme, config

if [ "$is_os_android_termux" = "1" ]; then
  echo ">> Begin setting up dependencies-android-termux.sh"

  touch ~/.bash_syle

  echo '''
# chroot to set up /tmp /etc and other fds for linux
termux-chroot
''' >> ~/.bash_syle

  ##########################################################
  # Install Packages
  ##########################################################
  pkg install -y proot # needed for android termux fhd fixes
  pkg install -y nodejs
  pkg install -y fzf
  pkg install -y vim
  pkg install -y git
  pkg install -y tig
  pkg install -y python
  pkg install -y bat
  pkg install -y curl
  pkg install -y git
  pkg install -y tmux

  ##########################################################
  # Termux Dracula Theme
  ##########################################################
  mkdir ~/.termux
  echo '''
background:     #282A36
foreground:     #F8F8F2

color0:         #000000
color8:         #4D4D4D

color1:         #FF5555
color9:         #FF6E67

color2:         #50FA7B
color10:        #5AF78E

color3:         #F1FA8C
color11:        #F4F99D

color4:         #BD93F9
color12:        #CAA9FA

color5:         #FF79C6
color13:        #FF92D0

color6:         #8BE9FD
color14:        #9AEDFE

color7:         #BFBFBF
color15:        #E6E6E6
''' > ~/.termux/colors.properties

  ##########################################################
  # Termux Config
  ##########################################################
  echo '''
# Send the Escape key.
back-key=escape
# black theme
use-black-ui = true
''' > ~/.termux/termux.properties

  ##########################################################
  # Update and Clean
  ##########################################################
  pkg update -y
  pkg upgrade -y
  pkg autoclean -y

  source ~/.bash_syle

  ##########################################################
  # Install Font and Lightweight Profile
  ##########################################################
  curl -s $BASH_PROFILE_CODE_REPO_RAW_URL/fonts/FiraCode-Regular.ttf -o ~/.termux/font.ttf
  curl -s $BASH_PROFILE_CODE_REPO_RAW_URL/run.sh | bash -s -- --prod  --lightweight --files="git.js,vim-configurations.js,vim-vundle.sh,bash-inputrc.js,bash-autocomplete.js,bash-syle-content.js"

else
  echo ">> Skipped dependencies-android-termux.sh"
fi
