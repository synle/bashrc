#! /bin/sh
##########################################################
# Dependencies installation
##########################################################
# install nvm and node
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

## install other nvm version
echo "  >> Setting up nvm node versions"

function nvmInstallNode(){
  echo "    >> Install node $1"
  nvm install "$1" &>/dev/null
}


DEFAULT_NVM_VERSION=12
nvmInstallNode $DEFAULT_NVM_VERSION
nvmInstallNode lts

echo "    >> nvm alias default $DEFAULT_NVM_VERSION"
nvm alias default $DEFAULT_NVM_VERSION &>/dev/null
nvm use default &>/dev/null
