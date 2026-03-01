# software/bootstrap/setup.sh - Universal bootstrap script for all platforms - Auto-detects OS and installs the appropriate dependencies
curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --files="""
  software/bootstrap/profile-core.sh
  software/bootstrap/dependencies/mac.sh
  software/bootstrap/dependencies/ubuntu.sh
  software/bootstrap/dependencies/windows.sh
  software/bootstrap/dependencies/chrome_os_linux.sh
  software/bootstrap/dependencies/android_termux.sh
  software/bootstrap/dependencies/arch_linux.sh
  software/bootstrap/dependencies/steamos.sh
""" && \ 
curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod
