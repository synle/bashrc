echo '>> Setting up WSL2 binary'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo '>> Bootstrap Powershell $Profile'
powershell.exe -command "Set-Executionpolicy RemoteSigned -Scope CurrentUser"
