/// <reference path="../index.js" />

/** * Registers mise binary paths and lazy-loading script with bashrc. */
async function doWork() {
  console.log(`  >> Register mise binary with bashrc ${MISE_DIR}`);
  console.log(`    >> Register mise node path with bashrc ${MISE_NODE_PATH}`);

  registerWithBashSyle(
    "mise - polyglot runtime manager",
    `
    # hookup binary - add default node version to PATH
    export PATH="${MISE_NODE_PATH}/bin:\$PATH"
    export PATH="\$HOME/.local/bin:\$PATH"

    # initialize mise environment
    eval "\$(mise activate bash --shims)"
  `,
  );
}
