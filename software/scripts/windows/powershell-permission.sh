#!/usr/bin/env bash
echo '>> Setting up PowerShell Remote Sign Permission'
powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"
