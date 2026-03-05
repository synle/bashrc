# software/bootstrap/dependencies/windows.sh
# Windows (WSL) dependencies - drive symlinks, folder setup, WSL2 config

if [ "$is_os_windows" = "1" ]; then
  echo ">> Begin setting up dependencies/windows.sh"

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

  # ---- GUI apps (via winget on the Windows side) ----
  if command -v winget.exe &>/dev/null; then
    echo '>> Installing Windows GUI apps with winget'
    function installWingetPackage() {
      echo -n ">> $1 >> Installing with Winget >> "
      if winget.exe list --id "$1" -e &>/dev/null; then
        echo "Skipped"
      elif winget.exe install --id "$1" -e --accept-source-agreements --accept-package-agreements &>/dev/null; then
        echo "Success"
      else
        echo "Error"
      fi
    }

    installWingetPackage 7zip.7zip
    installWingetPackage Audacity.Audacity
    installWingetPackage Bambulab.Bambustudio
    installWingetPackage BlenderFoundation.Blender
    installWingetPackage Brave.Brave
    installWingetPackage CodeSector.TeraCopy
    installWingetPackage Discord.Discord
    installWingetPackage dotPDN.PaintDotNet
    installWingetPackage EclipseAdoptium.Temurin.21.JDK
    installWingetPackage Git.Git
    installWingetPackage Greenshot.Greenshot
    installWingetPackage HandBrake.HandBrake
    installWingetPackage Inkscape.Inkscape
    installWingetPackage KDE.Krita
    installWingetPackage Microsoft.DotNet.DesktopRuntime.7
    installWingetPackage Microsoft.VCRedist.2015+.x64
    installWingetPackage Microsoft.VisualStudioCode
    installWingetPackage Mozilla.FiraCode
    installWingetPackage OpenJS.NodeJS
    installWingetPackage PuTTY.PuTTY
    installWingetPackage Python.Python.3
    installWingetPackage Rufus.Rufus
    installWingetPackage SublimeHQ.SublimeMerge
    installWingetPackage SublimeHQ.SublimeText.4
    installWingetPackage Ultimaker.Cura
    installWingetPackage Valve.Steam
    installWingetPackage VideoLAN.VLC
    installWingetPackage VSCodium.VSCodium
    installWingetPackage WinFSP.WinFSP
    installWingetPackage WinFSP.SSHFS
    installWingetPackage WinMerge.WinMerge
    installWingetPackage WinSCP.WinSCP
    installWingetPackage Zoom.Zoom
  fi

else
  echo ">> Skipped dependencies/windows.sh"
fi
