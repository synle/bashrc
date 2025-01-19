# for linux mint
# Download VS Code configurations and save to Preferences.sublime-settings
curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-configurations" \
  -o "$HOME/.config/VSCodium/User/settings.json"

# Download VS Code keybindings and save to Default (Linux).sublime-keymap
curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-keybindings-linux" \
  -o "$HOME/.config/VSCodium/User/keybindings.json"
