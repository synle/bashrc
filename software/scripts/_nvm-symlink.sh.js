async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".nvm");

  console.log(
    echoColor2(`  >> Symlink for nvm in global space: ${targetPath}`)
  );
  console.log(`
    DEFAULT_NVM_VERSION=v12.22.1
    echo "    >> nvm default binary ${targetPath}/versions/node/$DEFAULT_NVM_VERSION/bin/node"
    sudo ln -s "${targetPath}/versions/node/$DEFAULT_NVM_VERSION/bin/node" "/usr/local/bin/node" &>/dev/null
    sudo ln -s "${targetPath}/versions/node/$DEFAULT_NVM_VERSION/bin/npm" "/usr/local/bin/npm" &>/dev/null
  `);

  console.log(
    echoColor2(`  >> Register NVM binary with bashrc: ${targetPath}`)
  );

  // bootstrap nvm with bash_syle
  let bashrcTextContent = readText(BASE_BASH_SYLE);
  bashrcTextContent = prependTextBlock(
    bashrcTextContent,
    "nvm - node version manager", // key
    `[ -s ${targetPath}/nvm.sh ] && . ${targetPath}/nvm.sh`
  );
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}
