#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/wsl/_full-setup.sh
# WSL-specific dependencies - PowerShell modules for Windows interop

echo ">> Begin setting up dependencies/wsl/deps.sh"

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
