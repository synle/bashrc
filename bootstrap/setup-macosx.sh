# bootstrap/setup-macosx.sh
# Bootstrap script for macOS
# Sets up bash profile and installs Homebrew dependencies

sudo echo '> Initializing Environment' && \
 curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --pre-scripts="""
  bash-first-and-only-one-time.sh
  bash-profile-barebone.sh
  bootstrap/dependencies-mac.sh
"""
