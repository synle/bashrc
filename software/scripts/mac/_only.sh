#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

echo '>> Setting macOS Defaults'

################################################################################
# ---- Screenshots ----
################################################################################
defaults write com.apple.screencapture location ~/Desktop/_screenshots

################################################################################
# ---- VS Code Symlink ----
################################################################################
echo '>> Setting up VS Code symlink for mac'
ln -s "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" /usr/local/bin/code 2> /dev/null

################################################################################
# ---- Window Animations ----
################################################################################
echo '>> Applying window animation tweaks'
defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false   # Removes the open/close animation on all Cocoa windows (instant appear/disappear)
defaults write -g QLPanelAnimationDuration -float 0                            # Makes Quick Look previews (spacebar in Finder) appear instantly with no fade
defaults write NSGlobalDomain NSWindowResizeTime -float 0.001                  # Near-instant window resize for Cocoa apps (default is 0.2s ease-in-out)
defaults write -g NSWindowResizeSmoothing -bool false                          # Disables smooth interpolation during window resize drag (snappier, no frame blending)
defaults write NSGlobalDomain NSWindowSupportsAutomaticInlineTitle -bool false # Disables the inline title bar collapse/expand animation in toolbar

################################################################################
# ---- Finder ----
################################################################################
echo '>> Applying Finder tweaks'
defaults write com.apple.finder DisableAllAnimations -bool true # Stops Finder from animating Get Info, column resizing, and folder transitions
defaults write com.apple.finder AnimateWindowZoom -bool false   # Disables the zoom animation when opening folders in new Finder windows
# WARNING: spring-loaded delay 0 means folders open instantly on drag-hover. Easy to accidentally open wrong folders.
#   To revert: defaults write NSGlobalDomain com.apple.springing.delay -float 0.5
defaults write NSGlobalDomain com.apple.springing.delay -float 0           # When dragging a file over a folder, it opens instantly instead of waiting 0.5s
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true         # Shows the full Unix path (e.g. /Users/you/Documents) in the Finder title bar
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false # Stops the "are you sure you want to change the extension?" popup when renaming files

################################################################################
# ---- Dock & Mission Control ----
################################################################################
echo '>> Applying Dock & Mission Control tweaks'
defaults write com.apple.dock launchanim -bool false                     # Removes the bouncing icon animation when opening an app from the Dock
defaults write com.apple.dock expose-animation-duration -float 0.1       # Speeds up the Mission Control fly-in/fly-out transition (default 0.5s)
defaults write com.apple.dock autohide-delay -float 0                    # Dock appears immediately on hover instead of waiting (default 0.5s delay)
defaults write com.apple.dock autohide-time-modifier -float 0.1          # Dock slide-in/out animation takes 0.1s instead of default 0.7s
defaults write com.apple.dock mineffect -string scale                    # Changes minimize effect from Genie (heavy GPU warp animation) to Scale (lightweight fade)
defaults write com.apple.dock minimize-to-application -bool true         # Minimizes windows into their app icon instead of separate Dock section (less animation travel)
defaults write com.apple.dock show-recents -bool false                   # Disables show suggested and recent apps in dock
defaults write com.apple.dock autohide -bool true                        # Auto-hides the Dock to free screen space and reduce compositing when not in use
defaults write com.apple.dock workspaces-swoosh-animation-off -bool true # Instant workspace/Spaces switching instead of the slide animation
defaults write com.apple.dock workspaces-edge-delay -float 0             # Removes the delay before switching Spaces when dragging a window to screen edge (default 0.75s)
defaults write com.apple.dock mru-spaces -bool false                     # Stops Spaces from auto-rearranging based on usage (prevents Electron window repaints from layout shifts)
defaults write com.apple.dock wvous-bl-corner -int 0                     # Disables bottom-left hot corner (prevents accidental GPU-heavy Mission Control triggers)

################################################################################
# ---- Desktop & Stage Manager ----
################################################################################
echo '>> Applying Desktop & Stage Manager tweaks'
defaults write com.apple.WindowManager GloballyEnabled -bool false                  # Disables Stage Manager
defaults write com.apple.WindowManager EnableStandardClickToShowDesktop -bool false # Click wallpaper shows desktop only in Stage Manager (not always)
defaults write com.apple.WindowManager StandardHideWidgets -bool true               # Disables iPhone widgets (reduces cross-device rendering overhead)
defaults write com.apple.dashboard mcx-disabled -bool true                          # Disables dashboard (if still present on older macOS)

################################################################################
# ---- Accessibility > Display (WindowServer CPU reduction) ----
################################################################################
echo '>> Applying accessibility display tweaks'
defaults write com.apple.universalaccess reduceTransparency -bool true # Disables window/menu bar transparency effects, reducing GPU compositing overhead
defaults write com.apple.universalaccess reduceMotion -bool true       # Enables prefers-reduced-motion media query so Electron/web apps skip CSS animations and transitions

################################################################################
# ---- Safari & Web ----
################################################################################
defaults write com.apple.Safari WebKitInitialTimedLayoutDelay -float 0.1 # Reduces Safari's initial page render delay (default 0.25s) for faster first paint

################################################################################
# ---- System & Finder Behaviors ----
################################################################################
echo '>> Applying system behavior tweaks'
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true # Prevents macOS from creating .DS_Store files on network drives (NAS, SMB shares)
defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true     # Prevents macOS from creating .DS_Store files on USB/external drives
defaults write -g NSScrollAnimationEnabled -bool false                       # Disables momentum/smooth scrolling system-wide so scroll jumps instantly to position
defaults write -g NSAutoFillHeuristicControllerEnabled -bool false           # Turns off predictive text/autofill heuristics that consume CPU in the background
defaults write -g NSAutoHeuristicEnabled -bool false                         # Disables automatic heuristic-based suggestions (complements the above setting)
# WARNING: Disabling quarantine removes Gatekeeper's warning on downloaded apps. Malware won't trigger a prompt.
#   To revert: defaults write com.apple.LaunchServices LSQuarantine -bool true
defaults write com.apple.LaunchServices LSQuarantine -bool false # Removes the "this app was downloaded from the internet" quarantine warning dialog

################################################################################
# ---- Electron / Chromium Performance ----
################################################################################
echo '>> Applying Electron / Chromium tweaks'
# WARNING: Disabling App Nap keeps ALL background apps active. Higher battery drain and more CPU/memory usage.
#   To revert: defaults write NSGlobalDomain NSAppSleepDisabled -bool false
defaults write NSGlobalDomain NSAppSleepDisabled -bool true                      # Disables App Nap which throttles CPU/network for background apps (keeps Electron apps like VS Code, Slack responsive)
defaults write NSGlobalDomain CGFontRenderingFontSmoothingDisabled -bool false   # Keeps subpixel font smoothing enabled (Electron apps look blurry without it on non-Retina displays)
defaults write com.microsoft.VSCode ApplePressAndHoldEnabled -bool false         # Ensures key repeat works in VS Code (global setting sometimes doesn't stick for Electron apps)
defaults write com.microsoft.VSCodeInsiders ApplePressAndHoldEnabled -bool false # Same as above for VS Code Insiders build
defaults write com.sublimetext.4 ApplePressAndHoldEnabled -bool false            # Ensures key repeat works in Sublime Text 4

################################################################################
# ---- Mouse / Trackpad Speed ----
################################################################################
defaults write -g com.apple.mouse.scaling -float 3    # Sets mouse tracking speed to 3x (default ~1.0) for faster cursor movement
defaults write -g com.apple.trackpad.scaling -float 3 # Sets trackpad tracking speed to 3x (default ~1.0) for faster cursor movement

################################################################################
# ---- Key Repeat Speed ----
################################################################################
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false # Disables the press-and-hold accent character popup so keys repeat on hold instead
defaults delete NSGlobalDomain KeyRepeat 2> /dev/null              # Resets key repeat rate to system default (fastest possible after disabling press-and-hold)
defaults delete NSGlobalDomain InitialKeyRepeat 2> /dev/null       # Resets initial key repeat delay to system default (shortest delay before repeat starts)

################################################################################
# ---- Misc Performance ----
################################################################################
echo '>> Applying misc performance tweaks'
# WARNING: Keeping idle apps alive consumes more RAM. On low-memory machines this can cause more swap usage and slowdowns.
#   To revert: defaults write NSGlobalDomain NSDisableAutomaticTermination -bool false
defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true          # Prevents macOS from silently killing idle apps to free memory (keeps apps warm in RAM)
defaults write com.apple.systempreferences NSQuitAlwaysKeepsWindows -bool false # Disables Resume: apps won't reopen their previous windows on next launch
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false  # Turns off auto-correct that changes words as you type
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false      # Stops macOS from auto-capitalizing the first letter of sentences
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false    # Prevents -- from being replaced with an em dash character
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false   # Prevents straight quotes from being replaced with curly/smart quotes
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false  # Prevents double-space from being replaced with a period
# WARNING: Silencing the crash reporter means you won't notice when apps crash silently. Crashes are still logged to Console.app.
#   To revert: defaults write com.apple.CrashReporter DialogType -string "crashreport"
defaults write com.apple.CrashReporter DialogType -string "none"             # Silences the crash reporter popup when an app crashes (crashes still logged to Console)
defaults write com.apple.assistant.support "Assistant Enabled" -bool false   # Disables Siri completely, freeing background CPU, memory, and network usage
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true  # Save dialogs open in full expanded view showing the file browser by default
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true # Same as above for newer macOS versions that use a separate preference key
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true     # Print dialogs open in full expanded view showing all options by default
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true    # Same as above for newer macOS versions that use a separate preference key
defaults write com.apple.TimeMachine DoNotOfferNewDisksForBackup -bool true  # Stops the "use this disk for Time Machine?" popup when plugging in external drives
defaults write com.apple.ImageCapture disableHotPlug -bool true              # Stops Photos/Image Capture from auto-opening when plugging in a device (iPhone, camera, SD card)
ulimit -n 65536                                                              # Raises the max open file descriptors from 256 to 65536 (prevents Electron apps from running out of fds)

################################################################################
# ---- Microsoft AutoUpdate (MAU) ----
################################################################################
# Disable Microsoft Office's auto-update daemon and nag dialogs. MAU runs a
# launchd agent that wakes periodically to check Office updates — kills battery
# life, spawns dialogs, and shows red Dock badges. These keep Office installed
# and updateable on demand (open MAU manually) but stop all background activity.
echo '>> Disabling Microsoft AutoUpdate background activity'
launchctl bootout "gui/$(id -u)/com.microsoft.update.agent" 2> /dev/null || true # Stops the currently-running MAU launch agent (no-op if not loaded)
launchctl disable "gui/$(id -u)/com.microsoft.update.agent" 2> /dev/null || true # Prevents the MAU agent from auto-loading on next login
defaults write com.microsoft.autoupdate2 HowToCheck -string "Manual"             # Switches MAU from Automatic to Manual — no scheduled checks, only manual "Check for Updates"
defaults write com.microsoft.autoupdate2 DisableInsiderCheckbox -bool true       # Hides the Insider/beta channel toggle in the MAU UI to prevent accidental opt-in
defaults write com.microsoft.autoupdate2 StartDaemonOnAppLaunch -bool false      # Stops Office apps from spawning the MAU daemon every time you open Word/Excel/PowerPoint
defaults write com.microsoft.autoupdate2 SendAllTelemetryEnabled -bool false     # Opts out of MAU telemetry/diagnostic uploads

################################################################################
# ---- Restart Affected Services ----
################################################################################
echo '>> Restarting affected services'
for app in "Dock" "Finder" "Mail" "Safari" "SystemUIServer"; do
  killall "$app" > /dev/null 2>&1
done
echo '>> macOS tweaks applied'
