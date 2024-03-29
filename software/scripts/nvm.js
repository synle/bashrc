async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.nvm');

  console.log('  >> Download and installing nvm:', consoleLogColor4(targetPath));

  // TODO: fix me add the block to install nvm

  // bootstrap nvm with bash_syle
  console.log('    >> Register binary with bashrc', BASE_BASH_SYLE);
  let bashrcTextContent = readText(BASE_BASH_SYLE);
  bashrcTextContent = prependTextBlock(
    bashrcTextContent,
    'nvm - node version manager', // key
    `[ -s ${targetPath}/nvm.sh ] && . ${targetPath}/nvm.sh --no-use`, // this is to speed up nvm on mac
  );
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}
