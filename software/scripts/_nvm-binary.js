async function doWork() {
  const nvmPath = path.join(BASE_HOMEDIR_LINUX, '.nvm');

  console.log(`  >> Register NVM binary with bashrc ${nvmPath}`);

  // bootstrap nvm with bash_syle
  let bashrcTextContent = readText(BASE_BASH_SYLE);
  bashrcTextContent = prependTextBlock(
    bashrcTextContent,
    'nvm - node version manager', // key
    `[ -s ${nvmPath}/nvm.sh ] && . ${nvmPath}/nvm.sh`,
  );
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}
