# bootstrap/setup.sh - Universal bootstrap script for all platforms - Auto-detects OS and installs the appropriate dependencies

curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --pre-scripts="""
  bootstrap/profile-core.sh
  bootstrap/dependencies-mac.sh
  bootstrap/dependencies-ubuntu.sh
  bootstrap/dependencies-windows.sh
  bootstrap/dependencies-chrome-os-linux.sh
  bootstrap/dependencies-android-termux.sh
  bootstrap/dependencies-arch-linux-steam-deck.sh
"""
