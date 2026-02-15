echo '>> Setting up VS Code Extensions'

if [ $is_os_darwin_mac == "1" ]; then
  echo '  >> mac osx'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-extensions-macosx | bash -
else
  echo '  >> skipped - This OS is not supported'
fi
