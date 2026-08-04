/** Platform tweaks for Ubuntu / Debian / Mint - registers shell config. */
async function doWork() {
  registerPlatformTweaks(
    "Ubuntu",
    code`
      # update: OS package manager update/upgrade only
      alias update='sudo apt-get update -y && sudo apt-get upgrade -y && sudo apt-get autoclean && sudo apt-get clean && sudo apt-get autoremove -y'
    `,
  );
}
