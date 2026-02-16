##########################################################
# Windows Dependencies
##########################################################

echo '>> Creating the Powershell User Profile: the following might need be run manually'
echo 'New-Item $profile -Type File -Force'

echo '>> Setting up WSL2 binary'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo '  >> wsl --set-default-version 2'

# subl "$profile"
# powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"
# https://stackoverflow.com/questions/12143245/powershell-configuration-with-an-rc-like-file

# symlink for WSL mountpoints
echo '  >> symlink for WSL mountpoint'
sudo rm -f /c
sudo rm -f /d
if [ -d /mnt/c ]; then
  sudo ln -s /mnt/c /
fi
if [ -d /mnt/d ]; then
  sudo ln -s /mnt/d /
fi
