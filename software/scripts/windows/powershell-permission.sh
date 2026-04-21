#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

echo '> Setting up PowerShell Remote Sign Permission'
powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"

################################################################################
# ---- Printer Setup ----
################################################################################
PRINTER_NAME="SyHousePrinter"
PRINTER_IP=$(grep -i "printer" software/metadata/ip-address.config 2>/dev/null | grep "^[0-9]" | head -1 | cut -d: -f1 | tr -d ' ')

if [ -n "$PRINTER_IP" ]; then
  echo "> Setting up printer $PRINTER_NAME at $PRINTER_IP on Windows via PowerShell"
  powershell.exe -NoProfile -Command "
    Remove-Printer -Name '$PRINTER_NAME' -ErrorAction SilentlyContinue
    Remove-PrinterPort -Name 'IP_$PRINTER_IP' -ErrorAction SilentlyContinue

    Add-PrinterPort -Name 'IP_$PRINTER_IP' -PrinterHostAddress '$PRINTER_IP'

    Add-Printer -Name '$PRINTER_NAME' -DriverName 'Microsoft PS Class Driver' -PortName 'IP_$PRINTER_IP'

    Write-Host 'Printer $PRINTER_NAME added at $PRINTER_IP (Microsoft PS Class Driver)'
    Get-Printer -Name '$PRINTER_NAME' | Format-List Name,DriverName,PortName
  "
else
  echo '> Skipped printer setup: no printer entry found in ip-address.config'
fi
