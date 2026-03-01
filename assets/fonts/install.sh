# Fonts - Linux / MacOS
cd ~/Desktop
curl -sSLJ --parallel --parallel-max 10 \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Code-PL-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Code-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Mono-PL-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Mono-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Retina.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Trace-Regular.ttf
echo "Done downloading fonts"

# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Code-PL-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Code-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Mono-PL-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Cascadia-Mono-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-Retina.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Fira-Code-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/assets/fonts/Trace-Regular.ttf"
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"