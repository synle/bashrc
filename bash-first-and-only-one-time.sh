#! /bin/sh
##########################################################
# Dependencies Installation (one-time setup)
##########################################################
DEFAULT_NVM_NODE_VERSION=24

##########################################################
# Install NVM and Node
##########################################################
echo "  >> Installing nvm - node version manager"

NVM_DIR=~/.nvm
if [ -s $NVM_DIR/nvm.sh ]; then
  echo "    >> Skipped"
else
  echo "    >> Install nvm"
  git clone --depth 1 -b master https://github.com/creationix/nvm.git $NVM_DIR &>/dev/null
  pushd $NVM_DIR &>/dev/null
  git checkout `git describe --abbrev=0 --tags --match "v[0-9]*" $(git rev-list --tags --max-count=1)`  &>/dev/null
  . ./nvm.sh
  popd &>/dev/null
fi

##########################################################
# Install Node Versions
##########################################################
echo "  >> Setting up nvm node versions"

function nvmInstallNode(){
  echo "    >> Install node $1"
  nvm install "$1" &>/dev/null
}

nvmInstallNode $DEFAULT_NVM_NODE_VERSION
nvmInstallNode lts

echo "    >> nvm alias default $DEFAULT_NVM_NODE_VERSION"
nvm alias default $DEFAULT_NVM_NODE_VERSION &>/dev/null
nvm use default &>/dev/null

##########################################################
# Install Global NPM Packages
##########################################################
echo "    >> install yarn prettier"
npm install --global yarn prettier &>/dev/null
