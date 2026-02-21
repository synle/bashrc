async function doWork() {
  registerPlatformTweaks(
    'Only Mac',
    '.bash_syle_only_mac',
    `
# begin mac tweaks
defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false # Disable opening/closing window animations
defaults write -g QLPanelAnimationDuration -float 0 # Disable Quick Look fade-in/out
defaults write NSGlobalDomain NSWindowResizeTime -float 0.001 # Accelerate window resizing (Cocoa apps)
defaults write com.apple.finder DisableAllAnimations -bool true # Disable Finder animations (Info windows, etc.)
# --- Dock & Mission Control ---
defaults write com.apple.dock launchanim -bool false # Disable Dock opening animations
defaults write com.apple.dock expose-animation-duration -float 0.1 # Speed up Mission Control animations
defaults write com.apple.dock autohide-delay -float 0 # Remove Dock hide/show delay
defaults write com.apple.dock autohide-time-modifier -float 0.1 # Speed up the animation of showing the Dock
# --- Safari & Web ---
defaults write com.apple.Safari WebKitInitialTimedLayoutDelay -float 0.1 # Reduce rendering delay (making pages feel like they load faster)
# --- System & Finder Behaviors ---
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true # Disable .DS_Store on network and USB volumes (Prevents lag on external drives)
defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true
defaults write -g NSScrollAnimationEnabled -bool false # Disable smooth scrolling (Saves GPU cycles on older hardware)
defaults write -g NSAutoFillHeuristicControllerEnabled -bool false # Disable "Heuristic" predictive features to save CPU
defaults write -g NSAutoHeuristicEnabled -bool false
defaults write com.apple.LaunchServices LSQuarantine -bool false # Disable the "Are you sure you want to open this app?" dialog
defaults write -g com.apple.mouse.scaling -float 3 # Increase trackpad/mouse tracking speed beyond the slider limit
defaults write -g com.apple.trackpad.scaling -float 3
# Disable the delay when typing (Key Repeat Speed)
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false # This makes the cursor fly across the screen when holding a key
defaults delete NSGlobalDomain KeyRepeat
defaults delete NSGlobalDomain InitialKeyRepeat
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true # Disable window animations and "Get Info" animations in Finder
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false
# end mac tweaks

# suppress bash legacy warning in Catalina
export BASH_SILENCE_DEPRECATION_WARNING=1

# Add Visual Studio Code (code)
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# Only Mac alias
alias find2='fd'
alias brave='open "/Applications/Brave\\ Browser.app" --args --disable-smooth-scrolling'
alias chrome='open "/Applications/Google\\ Chrome.app" --args --disable-smooth-scrolling'
alias sqluinative='open "/Applications/sqlui-native.app" --args --disable-smooth-scrolling'
alias sql="sqluinative"
    `.trim(),
  );
}
