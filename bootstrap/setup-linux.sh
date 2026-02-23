# bootstrap/setup-linux.sh
# Bootstrap script for Ubuntu / Debian-based Linux
# Sets up bash profile and installs Ubuntu dependencies

sudo echo '> Initializing Environment' && \
 curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --pre-scripts="""
  bash-first-and-only-one-time.sh
  bash-profile-barebone.sh
  bootstrap/dependencies-ubuntu.sh
"""
