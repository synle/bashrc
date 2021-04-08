echo '>> Setting OSX Defaults'

#screenshot folder
mkdir -p ~/Desktop/_screenshots
defaults write com.apple.screencapture location ~/Desktop/_screenshots;


# change the default shell to bash
echo ">> Set default shell as BASH (Catalina Mods)"
chsh -s /bin/bash
