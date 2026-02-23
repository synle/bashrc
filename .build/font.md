# Fonts - Linux / MacOS
cd ~/Desktop
curl -sSLJ --parallel --parallel-max 10 \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaCode.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaCodePL.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaMono.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaMonoPL.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Retina.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Trace.ttf
echo "Done downloading fonts"

# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaCode.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaCodePL.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaMono.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/CascadiaMonoPL.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-Retina.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/FiraCode-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Trace.ttf"
)
$urls | Start-BitsTransfer -Destination .
echo "Done downloading fonts"