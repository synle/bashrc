# Mac OS X Notes

## App List

- [Monitor Control](https://github.com/MonitorControl/MonitorControl) - Control Brightness
- KAP - Screen Recording
- KEKA - Unzip

## Tweaks

All macOS `defaults write` tweaks (UI, animations, WindowServer performance) are consolidated in `software/scripts/mac/_only.sh`. This runs automatically as part of the setup pipeline.

Includes:

- Reduce transparency and motion (biggest WindowServer CPU wins)
- Disable all window/Finder/Dock animations
- Scale effect for minimize (lighter than genie)
- Disable dock recent apps, auto-rearrange Spaces
- Disable Stage Manager and iPhone Widgets
- Speed up Mission Control, disable dashboard
- Electron/Chromium performance tweaks
- Key repeat, mouse/trackpad speed
- Misc: disable auto-correct, Siri, crash reporter popups, etc.

### Manual Steps (System Settings)

Some settings may need to be verified through the UI:

1. **System Settings > Accessibility > Display**
   - Reduce transparency: ON
   - Reduce motion: ON
2. **System Settings > Desktop & Dock**
   - Animate opening applications: OFF
   - Minimized window animation: Scale Effect
   - Show suggested and recent apps in Dock: OFF
   - Automatically rearrange Spaces based on most recent use: OFF
   - Click wallpaper to show desktop: Only in Stage Manager
3. **External Monitors**
   - If WindowServer CPU is still high, disconnect external monitors to test
   - 4K monitors at scaled resolution are especially taxing

## Open Core Legacy Patcher - Electron (OpenGL) fixes

```bash

curl -fsSL https://raw.githubusercontent.com/synle/bashrc/master/software/scripts/mac/tweaks-electron-oclp.py | python3

```
