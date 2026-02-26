/// <reference path="../index.js" />

/** * Registers fnm (Fast Node Manager) binary paths and env setup script with bashrc. */
async function doWork() {
  console.log(`  >> Register fnm binary with bashrc ${FNM_DIR}`);
  console.log(`    >> Register fnm default node path with bashrc ${FNM_DEFAULT_NODE_PATH}`);

  registerWithBashSyleProfile(
    "fnm - fast node manager",
    `
    # hookup binary - add default node version to PATH
    export FNM_DIR="${FNM_DIR}"
    export PATH="${FNM_DIR}:\$PATH"
    export PATH="${FNM_DEFAULT_NODE_PATH}/bin:\$PATH"

    # initialize fnm
    eval "\$(fnm env)"
  `,
  );
}
