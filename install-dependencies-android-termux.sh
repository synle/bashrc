pkg install nodejs
pkg install fzf
pkg install vim
pkg install git
pkg install python

echo '''
# Send the Escape key.
back-key=escape

# black theme
use-black-ui = true
''' > ~/.termux/termux.properties

# reload termux
termux-reload-settings
