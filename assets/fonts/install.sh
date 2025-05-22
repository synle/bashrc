#!/usr/bin/env bash

# Fonts - Linux / MacOS
cd ~/Desktop
curl -fsSL --parallel --parallel-max 10 \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Code-PL-Roman.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Code-Roman.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Mono-PL-Roman.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Mono-Roman.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Bold.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Light.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Medium.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Regular.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Retina.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-SemiBold.ttf \
  -O https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Trace-Regular.ttf
echo "Done downloading fonts"

# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Code-PL-Roman.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Code-Roman.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Mono-PL-Roman.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Cascadia-Mono-Roman.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Bold.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Light.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Medium.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Regular.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-Retina.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Fira-Code-SemiBold.ttf",
  "https://api.github.com/repos/synle/bashrc/contents/assets/fonts/Trace-Regular.ttf"
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"