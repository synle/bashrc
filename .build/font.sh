# Fonts - Linux / MacOS
cd ~/Desktop
curl -sSLJ --parallel --parallel-max 10 \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Code-PL-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Code-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Mono-PL-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Mono-Roman.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Retina.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Black.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Hack-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Hack-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-ExtraBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-ExtraBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-ExtraLight.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Thin.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Med.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-SemiBold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Black.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Semibold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Trace-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Bold.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Light.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Medium.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Regular.ttf \
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-SemiBold.ttf
echo "Done downloading fonts"

# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Code-PL-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Code-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Mono-PL-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Cascadia-Mono-Roman.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-Retina.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Fira-Code-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Black.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/GeistMono-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Hack-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Hack-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-ExtraBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Iosevka-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-ExtraBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-ExtraLight.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/JetBrainsMono-Thin.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Med.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/RecursiveMonoLnrSt-SemiBold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Black.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/SourceCodePro-Semibold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Trace-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Bold.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Light.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Medium.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-Regular.ttf",
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/VictorMono-SemiBold.ttf"
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"