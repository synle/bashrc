# bootstrap/setup-windows.sh
# Bootstrap script for Windows (WSL)
# Sets up bash profile and installs both Ubuntu and Windows dependencies

sudo echo '> Initializing Environment' && \
 curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --pre-scripts="""
  bash-first-and-only-one-time.sh
  bash-profile-barebone.sh
  bootstrap/dependencies-ubuntu.sh
  bootstrap/dependencies-windows.sh
"""
