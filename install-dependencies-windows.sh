echo '>> Setting up WSL2 binary'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# TODO Chotolatey
# https://chocolatey.org/install
# powershell:
# Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
# choco.exe install --confirm \
#   #   slack \ # note safe
#   wget \
#   jq \
#   firacode \
#   microsoft-teams \
#   vscode \
#   sublimetext3 \
#   qbittorrent \
#   vlc \
#   eclipse \
#   virtualbox \
#   7zip.install \
#   notepadplusplus.install \
#   git \
#   putty.install \
#   paint.net \
#   intellijidea-community \
#   audacity \
#   battle.net \
#   && echo '>> Installed packages with chocolatey'
