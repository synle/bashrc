# for linux mint
  curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-configurations" \
    -o "$HOME/.config/VSCodium/User/settings.json"

  curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-keybindings-linux" \
    -o "$HOME/.config/VSCodium/User/keybindings.json"

# for mac
  curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-configurations" \
    -o "$HOME/Library/Application Support/Code/User/settings.json"

  curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-keybindings-macosx" \
    -o "$HOME/Library/Application Support/Code/User/keybindings.json"

  curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-configurations" \
    -o "$HOME/Library/Application Support/VSCodium/User/settings.json"

  curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-keybindings-macosx" \
    -o "$HOME/Library/Application Support/VSCodium/User/keybindings.json"


# for windows
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-configurations" `
      -OutFile "$HOME\AppData\Roaming\VSCodium\User\settings.json"

  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-keybindings-windows" `
      -OutFile "$HOME\AppData\Roaming\VSCodium\User\keybindings.json"

  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-configurations" `
      -OutFile "$HOME\AppData\Roaming\Code\User\settings.json"

  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/vs-code-keybindings-windows" `
      -OutFile "$HOME\AppData\Roaming\Code\User\keybindings.json"
