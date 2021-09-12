echo '>> Setting up WSL2 binary'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart || echo "Error: dism.exe needs to be run as Administrator"
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart || echo "Error: dism.exe needs to be run as Administrator"

echo '>> Bootstrap Powershell $Profile'
powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"
