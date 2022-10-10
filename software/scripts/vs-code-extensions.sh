echo '>> Setting up VS Code Extensions'

if [ $is_os_darwin_mac == "1" ]; then
  echo '  >> mac osx'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-keybindings-macosx | bash -
elif [ $is_os_window == "1" ]; then
  echo '  >> windows'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-extensions-windows > /tmp/vscode-extension.ps1
  /mnt/c/Windows/System32/WindowsPowerShell/v1.0//powershell.exe -File /tmp/vscode-extension.ps1
elif [ $is_os_chromeos == "1" ]; then
  echo '  >> skipped - This OS is not supported'
elif [ $is_os_android_termux == "1" ]; then
  echo '  >> skipped - This OS is not supported'
elif [ $is_os_steamdeck == "1" ]; then
  echo '  >> skipped - This OS is not supported'
elif [ $is_os_ubuntu == "1" ]; then
  echo '  >> skipped - This OS is not supported'
else
  echo '  >> skipped - This OS is not supported'
fi
