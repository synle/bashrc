#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/windows/_full-setup.sh
# Windows (WSL) dependencies - drive symlinks, folder setup, WSL2 config

echo ">> Begin setting up dependencies/windows/deps.sh"
sudo -v

################################################################################
# ---- PowerShell Remote Sign Permission ----
################################################################################
echo '>> Setting up PowerShell Remote Sign Permission'
powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"

################################################################################
# ---- Drive Symlinks ----
################################################################################
WSL_DRIVES="c d e f g h"

echo '>> WSL mountpoint symlinks'
for drive in $WSL_DRIVES; do
  sudo rm -f "/$drive"
  if [ -d "/mnt/$drive" ]; then
    echo "  >> WSL mountpoint for /mnt/$drive"
    sudo ln -s "/mnt/$drive" /
  fi
done

################################################################################
# ---- D Drive Folders ----
################################################################################
D_DRIVE_FOLDERS="Applications Desktop Documents Downloads Games Pictures"

if [ -d "/mnt/d" ]; then
  echo '  >> Creating folders on /mnt/d'
  for dir in $D_DRIVE_FOLDERS; do
    echo "      >> /mnt/d/$dir"
    mkdir "/mnt/d/$dir" > /dev/null 2>&1
  done
fi

################################################################################
# ---- WSL Config ----
################################################################################
WSL_CONF="/etc/wsl.conf"
echo ">> Configuring $WSL_CONF"
sudo tee "$WSL_CONF" > /dev/null << 'EOF'
# automount Windows drives with metadata (preserves Linux file permissions on NTFS)
[automount]
enabled = true
options = "metadata"

# let WSL auto-generate /etc/resolv.conf for DNS resolution
[network]
generateResolvConf = true
EOF

################################################################################
# ---- Sudo Config ----
################################################################################
# Uncomment to enable passwordless sudo (WSL is single-user, no Windows Hello → PAM bridge exists)
# echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$USER > /dev/null
# sudo chmod 440 /etc/sudoers.d/$USER

# Uncomment to allow passwordless sudo for mount/umount/mkdir only (needed for
# auto-mounting UNC/network drives in the bash profile without a password prompt)
# echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/mount, /usr/bin/umount, /usr/bin/mkdir" | sudo tee /etc/sudoers.d/${USER}-mount > /dev/null
# sudo chmod 440 /etc/sudoers.d/${USER}-mount

################################################################################
# ---- PowerShell AudioDeviceCmdlets Module ----
################################################################################
echo ">> Installing PowerShell AudioDeviceCmdlets module (CurrentUser scope)"
if powershell.exe -Command "Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser -Force" > /dev/null 2>&1; then
  echo "  >> AudioDeviceCmdlets (CurrentUser) installed successfully"
else
  echo "  >> AudioDeviceCmdlets (CurrentUser) failed to install"
fi

echo ">> Installing PowerShell AudioDeviceCmdlets module (AllUsers scope)"
if powershell.exe -Command "Install-Module -Name AudioDeviceCmdlets -Force" > /dev/null 2>&1; then
  echo "  >> AudioDeviceCmdlets (AllUsers) installed successfully"
else
  echo "  >> AudioDeviceCmdlets (AllUsers) failed to install (may need admin)"
fi

################################################################################
# ---- Printer Setup ----
################################################################################
PRINTER_NAME="SyHousePrinter"
PRINTER_IP=$(grep -i "printer" software/metadata/ip-address.config 2>/dev/null | grep "^[0-9]" | head -1 | cut -d: -f1 | tr -d ' ')

if [ -n "$PRINTER_IP" ]; then
  echo ">> Setting up printer $PRINTER_NAME at $PRINTER_IP on Windows via PowerShell"
  powershell.exe -NoProfile -Command "
    Remove-Printer -Name '$PRINTER_NAME' -ErrorAction SilentlyContinue
    Remove-PrinterPort -Name 'IP_$PRINTER_IP' -ErrorAction SilentlyContinue

    Add-PrinterPort -Name 'IP_$PRINTER_IP' -PrinterHostAddress '$PRINTER_IP'

    # try drivers in order of preference until one works
    \\\$drivers = @('Microsoft PS Class Driver', 'Microsoft IPP Class Driver', 'Generic / Text Only')
    \\\$added = \\\$false
    foreach (\\\$driver in \\\$drivers) {
      try {
        Add-Printer -Name '$PRINTER_NAME' -DriverName \\\$driver -PortName 'IP_$PRINTER_IP' -ErrorAction Stop
        Write-Host \"Printer $PRINTER_NAME added at $PRINTER_IP (driver: \\\$driver)\"
        \\\$added = \\\$true
        break
      } catch {
        Write-Host \"Driver '\\\$driver' not available, trying next...\"
      }
    }
    if (-not \\\$added) { Write-Host 'ERROR: No compatible printer driver found' }
  "
else
  echo '>> Skipped printer setup: no printer entry found in ip-address.config'
fi

################################################################################
# ---- Cleanup ----
################################################################################
echo '>> Cleaning up junk files from Windows mounts (Zone.Identifier, .DS_Store, ._*) - background with 60s timeout'
(
  find /mnt/c -name "*:Zone.Identifier" -delete &
  find /mnt/c -name ".DS_Store" -delete &
  find /mnt/c -name "._*" -delete &
  wait
) > /dev/null 2>&1 &
_CLEANUP_PID=$!
(sleep 60 && kill $_CLEANUP_PID) > /dev/null 2>&1 &
