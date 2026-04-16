#!/usr/bin/env bash

# Fonts - Linux / MacOS
cd ~/Desktop
curl -fsSL --parallel --parallel-max 10 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-PL-Roman.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-Roman.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-PL-Roman.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-Roman.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Bold.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Light.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Medium.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Regular.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Retina.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-SemiBold.ttf?raw=true \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Trace-Regular.ttf?raw=true
echo "Done downloading fonts"

# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-PL-Roman.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-Roman.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-PL-Roman.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-Roman.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Bold.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Light.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Medium.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Regular.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Retina.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-SemiBold.ttf?raw=true",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Trace-Regular.ttf?raw=true"
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"