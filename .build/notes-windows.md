# enable wsl

dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# set wsl2 as default

wsl --update
wsl --set-default-version 2

# mount point

# \\wsl$
