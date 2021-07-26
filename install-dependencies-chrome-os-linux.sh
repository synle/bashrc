sudo apt-get update
sudo apt-get install -y curl git vim python

export TEST_SCRIPT_FILES="""
software/scripts/sublime-text-configurations.js
software/scripts/sublime-text-keybindings.js
""" && export DEBUG_WRITE_TO_HOME='1' && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-live.sh | bash

cat test_script_sublime_common_keybindings > ~/.config/sublime-text-3/Packages/User/Default\ \(Linux\).sublime-keymap
cat test_script_sublime_common_settings > ~/.config/sublime-text-3/Packages/User/Preferences.sublime-settings

rm ~/test_script*
