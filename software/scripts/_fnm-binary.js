/// <reference path="../index.js" />

/** * Registers fnm (Fast Node Manager) binary paths and lazy-loading script with bashrc. */
async function doWork() {
  console.log(`  >> Register fnm binary with bashrc ${FNM_DIR}`);
  console.log(`    >> Register fnm binary with bashrc ${FNM_DEFAULT_NODE_PATH}`);

  registerWithBashSyle(
    "fnm - fast node manager",
    `
    # hookup binary - add default node version to PATH
    export PATH="${FNM_DEFAULT_NODE_PATH}/bin:\$PATH"
    export PATH="${FNM_DIR}:\$PATH"

    # initialize fnm environment
    eval "\$(fnm env --shell bash)"
  `,
  );
}
