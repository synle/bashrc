/// <reference path="../index.js" />

/** * Registers bash aliases for jq and a json file viewer function. */
async function doWork() {
  console.log("  >> Setting up jq alias in bashrc", BASE_BASH_SYLE);
  registerWithBashSyleProfile(
    "jq",
    trimLeftSpaces(`
      alias jq=/opt/jq
      json(){
        cat "$1" | jq .
      }
    `),
  );
}
