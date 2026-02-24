These fonts are copied from the owner of Fira Code. Repo is at https://github.com/tonsky/FiraCode and https://www.fontspace.com/trace-font-f3625

### Font Install Script

https://raw.githubusercontent.com/synle/bashrc/master/.build/font.md

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
