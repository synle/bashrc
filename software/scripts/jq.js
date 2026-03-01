/** * Registers bash aliases for jq and a json file viewer function. */
async function doWork() {
  log("  >> Setting up jq alias in bashrc", BASH_SYLE_PATH);
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
