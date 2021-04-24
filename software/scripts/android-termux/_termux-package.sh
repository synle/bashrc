# termux packages
function packageInstall(){
  echo "  >> pkg install $@"
  pkg install -y "$@" &> /dev/null
}

packageInstall nodejs
packageInstall fzf
packageInstall vim
packageInstall git
packageInstall tig
packageInstall python
packageInstall bat
packageInstall perl 
packageInstall jq 

# clean loose packages
pkg clean  &> /dev/null
pkg autoclean  &> /dev/null

# create the termux prop dir
mkdir -p ~/.termux


# change root
# note that android termux does not have /tmp mapped correctly - this allow us to do things with git clone 
# https://wiki.termux.com/wiki/Differences_from_Linux
packageInstall proot 
termux-chroot
