/// <reference path="../index.js" />

/** * Registers a bash alias to use prettyping as the default ping command. */
async function doWork() {
  console.log("  >> Setting up pretty ping alias in bashrc", BASH_SYLE_PATH);
  registerWithBashSyleProfile("pretty ping", `alias ping=prettyping`);
}
