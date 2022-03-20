echo '>> Setting up WSL2 binary'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# short alias
New-Alias g git
New-Alias br cls

# node-gyp - run this in powershell as admin
# https://github.com/nodejs/node-gyp#on-windows
# npm install --global windows-build-tools

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
