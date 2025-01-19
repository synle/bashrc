# notes-linux.md

## Install

```bash

sudo echo '> Initializing Environment' && \
echo """
export is_os_darwin_mac='0'
export is_os_window='0'
export is_os_wsl='0'
export is_os_ubuntu='1'
export is_os_chromeos='0'
export is_os_mingw64='0'
export is_os_android_termux='0'
export is_os_arch_linux='0'
export is_os_steamdeck='0'
""" > ~/.bash_syle_os && source ~/.bash_syle_os && . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh)" && \
 . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"

```
