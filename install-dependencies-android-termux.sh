touch ~/.bashrc

echo '''
# chroot to set up /tmp /etc and other fds for linux
termux-chroot
''' >> ~/.bashrc

export is_os_darwin_mac='0'
export is_os_window='0'
export is_os_wsl='0'
export is_os_ubuntu='0'
export is_os_chromeos='0'
export is_os_mingw64='0'
export is_os_android_termux='1'

echo """
export is_os_darwin_mac='0'
export is_os_window='0'
export is_os_wsl='0'
export is_os_ubuntu='0'
export is_os_chromeos='0'
export is_os_mingw64='0'
export is_os_android_termux='1'
""" > ~/.bash_syle_os

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

# termux dracula theme
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

# termux config
echo '''
# Send the Escape key.
back-key=escape
# black theme
use-black-ui = true
''' > ~/.termux/termux.properties

pkg update -y
pkg upgrade -y
pkg autoclean -y

source ~/.bashrc

# use different font
curl https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Regular.ttf -o ~/.termux/font.ttf

. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh?$(date +%s))"
