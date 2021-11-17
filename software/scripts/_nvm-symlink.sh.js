async function doWork() {
  const nvmPath = path.join(BASE_HOMEDIR_LINUX, '.nvm');
  let targetPath = findDirSingle(nvmPath + '/versions/node', /v12[0-9.]+/);

  console.log(echo(`  >> Symlink for nvm in global space (node, npm, npx) ${targetPath}`));
  console.log(`
    sudo ln -s "${targetPath}/bin/node" "/usr/local/bin/node" &>/dev/null
    sudo ln -s "${targetPath}/bin/npm" "/usr/local/bin/npm" &>/dev/null
  `);
}
