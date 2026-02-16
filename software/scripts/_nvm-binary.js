async function doWork() {
  console.log(`  >> Register NVM binary with bashrc ${nvmBasePath}`);
  console.log(`    >> Register NVM binary with bashrc ${nvmDefaultNodePath}`);

  registerWithBashSyle(
    'nvm - node version manager',
    `
    # hook up nvm
    [ -s ${nvmBasePath}/nvm.sh ] && . ${nvmBasePath}/nvm.sh --no-use > /dev/null 2>&1

    # hookup binary - add default node version to PATH
    export PATH="${nvmDefaultNodePath}/bin:\$PATH"
  `,
  );
}
