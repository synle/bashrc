/// <reference path="../index.js" />

/** * Registers a bash alias to use prettyping as the default ping command. */
async function doWork() {
  console.log("  >> Setting up pretty ping alias in bashrc", BASE_BASH_SYLE);
  registerWithBashSyleProfile("pretty ping", `alias ping=prettyping`);
}
