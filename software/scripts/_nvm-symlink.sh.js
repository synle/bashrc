async function doWork() {
  console.log(echo(`    >> Symlink for nvm and node executables in /usr/local/bin ${nvmDefaultNodePath}`));
  console.log(`
    sudo rm -rf "/usr/local/bin/node" "/usr/local/bin/npm" "/usr/local/bin/yarn" "/usr/local/bin/npx"
    echo "      >> /usr/local/bin/node"
    sudo ln -s "${nvmDefaultNodePath}/bin/node" "/usr/local/bin/node" &>/dev/null
    echo "      >> /usr/local/bin/npm"
    sudo ln -s "${nvmDefaultNodePath}/bin/npm" "/usr/local/bin/npm" &>/dev/null
    echo "      >> /usr/local/bin/npx"
    sudo ln -s "${nvmDefaultNodePath}/bin/npx" "/usr/local/bin/npx" &>/dev/null
    echo "      >> /usr/local/bin/yarn"
    sudo ln -s "${nvmDefaultNodePath}/bin/yarn" "/usr/local/bin/yarn" &>/dev/null
  `);
}
