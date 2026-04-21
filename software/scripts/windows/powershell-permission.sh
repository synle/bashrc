#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

echo '> Setting up PowerShell Remote Sign Permission'
powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"
