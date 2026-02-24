# bootstrap/dependencies-windows.sh
# Windows (WSL) dependencies - drive symlinks, folder setup, WSL2 config

if [ "$is_os_window" = "1" ]; then

  ##########################################################
  # Windows Dependencies
  ##########################################################
  WSL_DRIVES="c d e f g h"
  D_DRIVE_FOLDERS="Applications Desktop Documents Downloads Games Pictures"

  # symlink for WSL mountpoints
  echo '>> WSL mountpoint symlinks'
  for drive in $WSL_DRIVES; do
    sudo rm -f "/$drive"
    if [ -d "/mnt/$drive" ]; then
      echo "  >> WSL mountpoint for /mnt/$drive"
      sudo ln -s "/mnt/$drive" /
    fi
  done

  # create common folders on D drive
  if [ -d "/mnt/d" ]; then
    echo '  >> Creating folders on /mnt/d'
    for dir in $D_DRIVE_FOLDERS; do
      echo "      >> /mnt/d/$dir"
      mkdir "/mnt/d/$dir" > /dev/null 2>&1
    done
  fi

  echo '>> Creating the Powershell User Profile: the following might need be run manually'
  echo 'New-Item $profile -Type File -Force'

  echo '>> Setting up WSL2 binary'
  dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart || echo "Error: dism.exe needs to be run as Administrator"
  dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart || echo "Error: dism.exe needs to be run as Administrator"

  echo '  >> wsl --set-default-version 2'

fi
