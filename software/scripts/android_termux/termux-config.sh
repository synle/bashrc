#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

echo '>> Setup termux config'

################################################################################
# ---- Termux Properties ----
################################################################################
echo '
# maps the Android back button to ESC instead of closing the terminal
# useful for exiting vim insert mode, dismissing fzf, and cancelling prompts
back-key=escape

# black theme
use-black-ui = true

# extra keys row - adds two rows of special keys above the on-screen keyboard
# since Android keyboards lack ESC, TAB, CTRL, arrows, and pipe/tilde keys
# that are needed for vim, tmux, and general terminal use
extra-keys = [["ESC","TAB","CTRL","ALT","-","UP","HOME"],["FN","SHIFT","|","~","LEFT","DOWN","RIGHT"]]

# font size
font-size = 14
' > ~/.termux/termux.properties

################################################################################
# ---- Termux Dracula Theme ----
################################################################################
echo '
background:     #282A36
foreground:     #F8F8F2

color0:         #000000
color8:         #4D4D4D

color1:         #FF5555
color9:         #FF6E67

color2:         #50FA7B
color10:        #5AF78E

color3:         #F1FA8C
color11:        #F4F99D

color4:         #BD93F9
color12:        #CAA9FA

color5:         #FF79C6
color13:        #FF92D0

color6:         #8BE9FD
color14:        #9AEDFE

color7:         #BFBFBF
color15:        #E6E6E6
' > ~/.termux/colors.properties

# reload termux
termux-reload-settings
