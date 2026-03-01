/** * Registers fnm (Fast Node Manager) binary paths and env setup script with bashrc. */
async function doWork() {
  log(`  >> Register fnm binary with bashrc ${FNM_DIR}`);
  log(`    >> Register fnm default node path with bashrc ${FNM_DEFAULT_NODE_PATH}`);

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
