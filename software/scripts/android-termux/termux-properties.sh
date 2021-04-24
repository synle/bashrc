echo '  >> Setup termux properties'

# termux config
echo '''
# Send the Escape key.
back-key=escape

# black theme
use-black-ui = true
''' > ~/.termux/termux.properties

# reload termux
termux-reload-settings
