async function doWork() {
  const nvmPath = path.join(BASE_HOMEDIR_LINUX, '.nvm');

  console.log(`  >> Register NVM binary with bashrc ${nvmPath}`);

  registerWithBashSyle('nvm - node version manager', `[ -s ${nvmPath}/nvm.sh ] && . ${nvmPath}/nvm.sh --no-use`);
}
