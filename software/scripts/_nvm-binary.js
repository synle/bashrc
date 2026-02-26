/// <reference path="../index.js" />

/** * Registers nvm (Node Version Manager) binary paths and lazy-loading script with bashrc. */
async function doWork() {
  console.log(`  >> Register nvm binary with bashrc ${NVM_DIR}`);
  console.log(`    >> Register nvm default node path with bashrc ${NVM_DEFAULT_NODE_PATH}`);

  registerWithBashSyle(
    "nvm - node version manager",
    `
    # hookup binary - add default node version to PATH
    export NVM_DIR="${NVM_DIR}"
    export PATH="${NVM_DEFAULT_NODE_PATH}/bin:\$PATH"

    # lazy-load nvm to avoid slow shell startup
    nvm() {
      unset -f nvm
      [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
      nvm "\$@"
    }
  `,
  );
}
