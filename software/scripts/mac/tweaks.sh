echo '>> Setting OSX Defaults'

#screenshot folder
mkdir -p ~/Desktop/_screenshots
defaults write com.apple.screencapture location ~/Desktop/_screenshots;

# vs code symlink
echo '>> Setting up VS code symlink for mac'
ln -s "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" /usr/local/bin/code
