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


DEFAULT_NVM_VERSION=v12.22.1
echo "    >> Install node 8"
nvm install 10 &>/dev/null
echo "    >> Install node 10"
nvm install 8 &>/dev/null
echo "    >> Install node $DEFAULT_NVM_VERSION"
nvm install $DEFAULT_NVM_VERSION &>/dev/null
echo "    >> Install node LTS"
nvm install lts &>/dev/null

echo "    >> nvm alias default $DEFAULT_NVM_VERSION"
nvm alias default 12 &>/dev/null
nvm use default &>/dev/null
