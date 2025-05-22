#!/usr/bin/env bash

# Fonts - Linux / MacOS
cd ~/Desktop
curl -fsSL --parallel --parallel-max 10 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-PL-Roman.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-Roman.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-PL-Roman.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-Roman.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Bold.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Light.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Medium.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Regular.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Retina.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-SemiBold.ttf?raw=1 \
  -O https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Trace-Regular.ttf?raw=1
echo "Done downloading fonts"

# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-PL-Roman.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Code-Roman.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-PL-Roman.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Cascadia-Mono-Roman.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Bold.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Light.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Medium.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Regular.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-Retina.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Fira-Code-SemiBold.ttf?raw=1",
  "https://github.com/synle/bashrc/blob/HEAD/assets/fonts/Trace-Regular.ttf?raw=1"
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"