async function doWork() {
  console.log(`  >> Register NVM binary with bashrc ${nvmBasePath}`);
  console.log(`    >> Register NVM binary with bashrc ${nvmDefaultNodePath}`);

  registerWithBashSyle(
    'nvm - node version manager',
    `
    # hookup binary - add default node version to PATH
    export PATH="${nvmDefaultNodePath}/bin:\$PATH"
    export NVM_DIR="${nvmBasePath}"

    # lazy load nvm - only source nvm.sh when nvm is actually called
    nvm() {
      unset -f nvm
      [ -s "${nvmBasePath}/nvm.sh" ] && . "${nvmBasePath}/nvm.sh" --no-use > /dev/null 2>&1
      nvm "\$@"
    }
  `,
  );
}
