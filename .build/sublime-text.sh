
# for linux mint
	curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/sublime-text-configurations" \
		-o "$HOME/.config/sublime-text/Packages/User/Preferences.sublime-settings"

	curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/sublime-text-keybindings-linux" \
		-o "$HOME/.config/sublime-text/Packages/User/Default (Linux).sublime-keymap"

# for mac
	curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/sublime-text-configurations" \
		-o "$HOME/Library/Application Support/Sublime Text/Packages/User/Preferences.sublime-settings"

	curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/sublime-text-keybindings-macosx" \
		-o "$HOME/Library/Application Support/Sublime Text/Packages/User/Default (OSX).sublime-keymap"

# for windows
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/sublime-text-configurations" `
    -OutFile "$HOME\AppData\Roaming\Sublime Text\Packages\User\Preferences.sublime-settings"

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/sublime-text-keybindings-windows" `
    -OutFile "$HOME\AppData\Roaming\Sublime Text\Packages\User\Default (Windows).sublime-keymap"
