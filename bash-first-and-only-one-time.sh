#! /bin/sh

##########################################################
# OS Flags
##########################################################
if [ ! -f ~/.bash_syle_os ]; then
  echo '''
##########################################################
# OS Flags (created by bash-first-and-only-one-time.sh)
##########################################################
export is_os_darwin_mac=0 && [ -d /Applications ] && export is_os_darwin_mac=1
export is_os_ubuntu=0 && apt-get -v &> /dev/null && export is_os_ubuntu=1
export is_os_chromeos=0 && { [ -f /dev/.cros_milestone ] || grep -qi cros /proc/version 2>/dev/null; } && export is_os_chromeos=1
export is_os_mingw64=0 && [ -d /mingw64 ] && export is_os_mingw64=1
export is_os_android_termux=0 && [ -d /data/data/com.termux ] && export is_os_android_termux=1
export is_os_arch_linux=0 && pacman -h &> /dev/null && export is_os_arch_linux=1 # for steam deck
export is_os_steamdeck=0 && pacman -h &> /dev/null && export is_os_steamdeck=1 # for steam deck
export is_os_redhat=0 && yum -v &> /dev/null && export is_os_redhat=1 # not used anymore
export is_os_window=0 && { [ -d /mnt/c/Windows ] || [ -d /c/Windows ]; } && export is_os_window=1
export is_os_wsl=0 && { grep -qi microsoft /proc/version 2>/dev/null || [ "$is_os_window" = "1" ]; } && export is_os_wsl=1
''' > ~/.bash_syle_os
fi


# append BASH_PROFILE_CODE_REPO_RAW_URL if not already in ~/.bash_syle_os
if [ -f ~/.bash_syle_os ] && ! grep -q "BASH_PROFILE_CODE_REPO_RAW_URL" ~/.bash_syle_os; then
  echo 'export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/synle/bashrc/master"' >> ~/.bash_syle_os
fi

[ -f ~/.bash_syle_os ] && . ~/.bash_syle_os
# end os flags

if [ "$is_os_android_termux" != "1" ]; then
  ##########################################################
  # Dependencies Installation (one-time setup)
  ##########################################################
  export DEFAULT_NVM_NODE_VERSION=24

  ##########################################################
  # Install NVM and Node
  ##########################################################
  echo "  >> Installing nvm - node version manager"

  NVM_DIR=~/.nvm
  if [ -s $NVM_DIR/nvm.sh ]; then
    echo "    >> Skipped"
  else
    echo "    >> Install nvm"
    git clone --depth 1 -b master https://github.com/creationix/nvm.git $NVM_DIR &>/dev/null
    pushd $NVM_DIR &>/dev/null
    git checkout `git describe --abbrev=0 --tags --match "v[0-9]*" $(git rev-list --tags --max-count=1)`  &>/dev/null
    . ./nvm.sh
    popd &>/dev/null
  fi

  ##########################################################
  # Install Node Versions
  ##########################################################
  echo "  >> Setting up nvm node versions"

  function nvmInstallNode(){
    echo "    >> Install node $1"
    nvm install "$1" &>/dev/null
  }

  nvmInstallNode $DEFAULT_NVM_NODE_VERSION
  nvmInstallNode lts

  echo "    >> nvm alias default $DEFAULT_NVM_NODE_VERSION"
  nvm alias default $DEFAULT_NVM_NODE_VERSION &>/dev/null
  nvm use default &>/dev/null

  ##########################################################
  # Install Global NPM Packages
  ##########################################################
  echo "    >> install yarn prettier"
  npm install --global yarn prettier &>/dev/null
fi
