echo '>> Setting OSX Defaults'

#screenshot folder
mkdir -p ~/Desktop/_screenshots
defaults write com.apple.screencapture location ~/Desktop/_screenshots;
