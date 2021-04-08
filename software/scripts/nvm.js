async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".nvm");

  console.log("  >> Download and installing nvm:", targetPath);

  // TODO: fix me add the block to install nvm

  // bootstrap nvm with bash_syle
  console.log("    >> Register binary with bashrc", BASE_BASH_SYLE);
  let bashrcTextContent = readText(BASE_BASH_SYLE);
  bashrcTextContent = prependTextBlock(
    bashrcTextContent,
    "nvm - node version manager", // key
    `[ -s ${targetPath}/nvm.sh ] && . ${targetPath}/nvm.sh`
  );
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}
