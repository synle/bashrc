async function doWork() {
  const nvmPath = path.join(BASE_HOMEDIR_LINUX, '.nvm');
  let targetPath = findDirSingle(nvmPath + '/versions/node', /v14[0-9.]+/);

  console.log(echo(`    >> Symlink for nvm and node executables in /usr/local/bin ${targetPath}`));
  console.log(`
    sudo rm -rf "/usr/local/bin/node" "/usr/local/bin/npm" "/usr/local/bin/yarn" "/usr/local/bin/npx"
    echo "      >> /usr/local/bin/node"
    sudo ln -s "${targetPath}/bin/node" "/usr/local/bin/node" &>/dev/null
    echo "      >> /usr/local/bin/npm"
    sudo ln -s "${targetPath}/bin/npm" "/usr/local/bin/npm" &>/dev/null
    echo "      >> /usr/local/bin/npx"
    sudo ln -s "${targetPath}/bin/npx" "/usr/local/bin/npx" &>/dev/null
    echo "      >> /usr/local/bin/yarn"
    sudo ln -s "${targetPath}/bin/yarn" "/usr/local/bin/yarn" &>/dev/null
  `);
}
