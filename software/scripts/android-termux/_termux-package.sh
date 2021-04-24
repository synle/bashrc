# termux packages
function packageInstall(){
  echo "    >> pkg install $@"
  pkg install -y "$@" &> /dev/null
}

echo '  >> Install packages'
packageInstall proot # needed for android termux fhd fixes
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
echo '  >> Clean up loose metadata for pkg'
pkg clean  &> /dev/null
pkg autoclean  &> /dev/null

# create the termux prop dir
echo '  >> Initiating termux properties'
mkdir -p ~/.termux


# change root
# note that android termux does not have /tmp mapped correctly - this allow us to do things with git clone 
# https://wiki.termux.com/wiki/Differences_from_Linux
termux-chroot &> /dev/null

