echo '>> Setting up VS Code Extensions'

if [ $is_os_darwin_mac == "1" ]; then
  echo '  >> mac osx'
  curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/.build/vs-code-extensions" | bash -
else
  echo '  >> skipped - This OS is not supported'
fi
