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


# change root
# note that android termux does not have /tmp mapped correctly - this allow us to do things with git clone 
# https://wiki.termux.com/wiki/Differences_from_Linux
packageInstall proot 
termux-chroot
