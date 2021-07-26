sudo apt-get update
sudo apt-get install -y curl git vim python

# set up as lightweight
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh?$(date +%s))"

# setting up sublime
export TEST_SCRIPT_FILES="""
software/scripts/sublime-text-configurations.js
software/scripts/sublime-text-keybindings.js
""" && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-live.sh | bash
