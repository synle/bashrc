These fonts are copied from the owner of Fira Code. Repo is at https://github.com/tonsky/FiraCode and https://www.fontspace.com/trace-font-f3625

### Font Install Script

<!-- BEGIN .build/font.sh -->
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
$urls | Start-BitsTransfer -Destination .
echo "Done downloading fonts"
```
<!-- END .build/font.sh -->

### Get Font Name Mappings

```
for f in ./*.ttf; do echo "$(basename "$f") => $(fc-query --format "%{family} %{style}\n" "$f" | head -1)"; done
```

### Font Mappings

┌───────────────────────┬────────────────────────┬────────────────────────────┐
│ Current Filename │ Actual Font Name │ New Filename │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ CascadiaCode.ttf │ Cascadia Code Roman │ Cascadia-Code-Roman.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ CascadiaCodePL.ttf │ Cascadia Code PL Roman │ Cascadia-Code-PL-Roman.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ CascadiaMono.ttf │ Cascadia Mono Roman │ Cascadia-Mono-Roman.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ CascadiaMonoPL.ttf │ Cascadia Mono PL Roman │ Cascadia-Mono-PL-Roman.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ FiraCode-Bold.ttf │ Fira Code Bold │ Fira-Code-Bold.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ FiraCode-Light.ttf │ Fira Code Light │ Fira-Code-Light.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ FiraCode-Medium.ttf │ Fira Code Medium │ Fira-Code-Medium.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ FiraCode-Regular.ttf │ Fira Code Regular │ Fira-Code-Regular.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ FiraCode-Retina.ttf │ Fira Code Retina │ Fira-Code-Retina.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ FiraCode-SemiBold.ttf │ Fira Code SemiBold │ Fira-Code-SemiBold.ttf │
├───────────────────────┼────────────────────────┼────────────────────────────┤
│ Trace.ttf │ Trace Regular │ Trace-Regular.ttf │
└───────────────────────┴────────────────────────┴────────────────────────────┘
