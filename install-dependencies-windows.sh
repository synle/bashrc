##########################################################
# Windows Dependencies
##########################################################
WSL_DRIVES="c d e f g h"
D_DRIVE_FOLDERS="Applications Desktop Documents Downloads Games Pictures"

# symlink for WSL mountpoints
echo '>> WSL mountpoint symlinks'
for drive in $WSL_DRIVES; do
  sudo rm -f /$drive
  if [ -d /mnt/$drive ]; then
    echo "  >> WSL mountpoint for /mnt/$drive"
    sudo ln -s /mnt/$drive /
  fi
done

# create common folders on D drive
if [ -d /mnt/d ]; then
  echo '  >> Creating folders on /mnt/d'
  for dir in $D_DRIVE_FOLDERS; do
    mkdir /mnt/d/$dir > /dev/null 2>&1
  done
fi

echo '>> Creating the Powershell User Profile: the following might need be run manually'
echo 'New-Item $profile -Type File -Force'

echo '>> Setting up WSL2 binary'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo '  >> wsl --set-default-version 2'

# subl "$profile"
# powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"
# https://stackoverflow.com/questions/12143245/powershell-configuration-with-an-rc-like-file
