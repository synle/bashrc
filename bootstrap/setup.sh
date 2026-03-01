# bootstrap/setup.sh - Universal bootstrap script for all platforms - Auto-detects OS and installs the appropriate dependencies
curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --files="""
  bootstrap/profile-core.sh
  bootstrap/dependencies/mac.sh
  bootstrap/dependencies/ubuntu.sh
  bootstrap/dependencies/windows.sh
  bootstrap/dependencies/chrome_os_linux.sh
  bootstrap/dependencies/android_termux.sh
  bootstrap/dependencies/arch_linux.sh
  bootstrap/dependencies/steamos.sh
"""
