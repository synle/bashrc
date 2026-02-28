These fonts are copied from the owner of Fira Code. Repo is at https://github.com/tonsky/FiraCode and https://www.fontspace.com/trace-font-f3625

### Font Install Script

<!-- BEGIN fonts/install.sh -->
```bash
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
  -O https://raw.githubusercontent.com/synle/bashrc/master/fonts/Trace-Regular.ttf
echo "Done downloading fonts"
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
  "https://raw.githubusercontent.com/synle/bashrc/master/fonts/Trace-Regular.ttf"
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"
```
<!-- END fonts/install.sh -->

### Font Mappings

Get Font Name Mappings

```bash
for f in ./*.ttf; do echo "$(basename "$f") => $(fc-query --format "%{family} %{style}\n" "$f" | head -1)"; done
```

```
Cascadia-Code-PL-Roman.ttf => Cascadia Code PL Roman,Regular
Cascadia-Code-Roman.ttf => Cascadia Code Roman,Regular
Cascadia-Mono-PL-Roman.ttf => Cascadia Mono PL Roman,Regular
Cascadia-Mono-Roman.ttf => Cascadia Mono Roman,Regular
Fira-Code-Bold.ttf => Fira Code Bold
Fira-Code-Light.ttf => Fira Code,Fira Code Light Light,Regular
Fira-Code-Medium.ttf => Fira Code,Fira Code Medium Medium,Regular
Fira-Code-Regular.ttf => Fira Code Regular
Fira-Code-Retina.ttf => Fira Code,Fira Code Retina Retina,Regular
Fira-Code-SemiBold.ttf => Fira Code,Fira Code SemiBold SemiBold,Regular
GeistMono-Black.ttf => Geist Mono,Geist Mono Black Black,Regular
GeistMono-Bold.ttf => Geist Mono Bold
GeistMono-Light.ttf => Geist Mono,Geist Mono Light Light,Regular
GeistMono-Medium.ttf => Geist Mono,Geist Mono Medium Medium,Regular
GeistMono-Regular.ttf => Geist Mono Regular
GeistMono-SemiBold.ttf => Geist Mono,Geist Mono SemiBold SemiBold,Regular
Hack-Bold.ttf => Hack Bold
Hack-Regular.ttf => Hack Regular
Iosevka-Bold.ttf => Iosevka Bold
Iosevka-ExtraBold.ttf => Iosevka,Iosevka Extrabold Extrabold,Regular
Iosevka-Light.ttf => Iosevka,Iosevka Light Light,Regular
Iosevka-Medium.ttf => Iosevka,Iosevka Medium Medium,Regular
Iosevka-Regular.ttf => Iosevka Regular
Iosevka-SemiBold.ttf => Iosevka,Iosevka Semibold Semibold,Regular
JetBrainsMono-Bold.ttf => JetBrains Mono Bold
JetBrainsMono-ExtraBold.ttf => JetBrains Mono,JetBrains Mono ExtraBold ExtraBold,Regular
JetBrainsMono-ExtraLight.ttf => JetBrains Mono,JetBrains Mono ExtraLight ExtraLight,Regular
JetBrainsMono-Light.ttf => JetBrains Mono,JetBrains Mono Light Light,Regular
JetBrainsMono-Medium.ttf => JetBrains Mono,JetBrains Mono Medium Medium,Regular
JetBrainsMono-Regular.ttf => JetBrains Mono Regular
JetBrainsMono-SemiBold.ttf => JetBrains Mono,JetBrains Mono SemiBold SemiBold,Regular
JetBrainsMono-Thin.ttf => JetBrains Mono,JetBrains Mono Thin Thin,Regular
RecursiveMonoLnrSt-Bold.ttf => Recursive Mono Linear Static,Recursive Mn Lnr St Bold
RecursiveMonoLnrSt-Light.ttf => Recursive Mono Linear Static,Recursive Mn Lnr St Lt Light,Regular
RecursiveMonoLnrSt-Med.ttf => Recursive Mono Linear Static,Recursive Mn Lnr St Med Medium,Regular
RecursiveMonoLnrSt-Regular.ttf => Recursive Mono Linear Static,Recursive Mn Lnr St Regular
RecursiveMonoLnrSt-SemiBold.ttf => Recursive Mono Linear Static,Recursive Mn Lnr St SmB SemiBold,Regular
SourceCodePro-Black.ttf => Source Code Pro,Source Code Pro Black Black,Regular
SourceCodePro-Bold.ttf => Source Code Pro Bold
SourceCodePro-Light.ttf => Source Code Pro,Source Code Pro Light Light,Regular
SourceCodePro-Medium.ttf => Source Code Pro,Source Code Pro Medium Medium,Regular
SourceCodePro-Regular.ttf => Source Code Pro Regular
SourceCodePro-Semibold.ttf => Source Code Pro,Source Code Pro Semibold Semibold,Regular
Trace-Regular.ttf => Trace Regular
VictorMono-Bold.ttf => Victor Mono Bold
VictorMono-Light.ttf => Victor Mono,Victor Mono Light Light,Regular
VictorMono-Medium.ttf => Victor Mono,Victor Mono Medium Medium,Regular
VictorMono-Regular.ttf => Victor Mono Regular
VictorMono-SemiBold.ttf => Victor Mono,Victor Mono SemiBold SemiBold,Regular
```
