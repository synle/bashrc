#!/usr/bin/env bash
# install gradle - build tool for Java/Kotlin (https://gradle.org)

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }

# Force refresh: remove existing binary
if [ "$IS_FORCE_REFRESH" == "1" ] && command -v gradle &>/dev/null; then
  echo ">> Force refresh: removing gradle"
  if [ "$is_os_mac" == "1" ]; then
    brew uninstall gradle &>/dev/null
  else
    sudo rm -f /usr/local/bin/gradle
    sudo rm -rf /opt/gradle
  fi
fi

# Skip if already installed
if command -v gradle &>/dev/null; then
  echo ">> Skipped gradle: already installed at $(which gradle)"
  exit 0
fi

echo '>> Installing gradle'
if [ "$is_os_mac" == "1" ]; then
  echo '>>> Installing with Homebrew'
  brew install gradle &>/dev/null
else
  echo '>>> Installing with package manager'
  if [ "$is_os_redhat" == "1" ]; then
    sudo yum install -y gradle &>/dev/null || sudo dnf install -y gradle &>/dev/null
  else
    sudo apt-get install -y gradle &>/dev/null
  fi
fi
