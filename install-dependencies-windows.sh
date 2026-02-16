##########################################################
# Windows Dependencies
##########################################################
# symlink for WSL mountpoints
echo '>> WSL mountpoint symlinks'
sudo rm -f /c /d /e
if [ -d /mnt/c ]; then
  echo '  >> WSL mountpoint for /mnt/c'
  sudo ln -s /mnt/c /
fi
if [ -d /mnt/d ]; then
  echo '  >> WSL mountpoint for /mnt/c'
  sudo ln -s /mnt/c /
fi
if [ -d /mnt/e ]; then
  echo '  >> WSL mountpoint for /mnt/c'
  sudo ln -s /mnt/c /
fi
if [ -d /mnt/d ]; then
  echo '  >> WSL mountpoint for /mnt/d'
  sudo ln -s /mnt/d /

  # only applicable for D drive
  echo '  >> Creating folders'
  mkdir /mnt/d/Applications > /dev/null 2>&1
  mkdir /mnt/d/Desktop > /dev/null 2>&1
  mkdir /mnt/d/Documents > /dev/null 2>&1
  mkdir /mnt/d/Downloads > /dev/null 2>&1
  mkdir /mnt/d/Games > /dev/null 2>&1
  mkdir /mnt/d/Pictures > /dev/null 2>&1
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
