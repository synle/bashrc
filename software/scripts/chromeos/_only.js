/** Platform tweaks for ChromeOS (Crostini Linux) - registers shell config. */
async function doWork() {
  registerPlatformTweaks(
    "ChromeOS",
    code`
      # update: OS package manager update/upgrade only (Crostini uses apt like Debian/Ubuntu)
      alias update='sudo apt-get update -y && sudo apt-get upgrade -y && sudo apt-get autoclean && sudo apt-get clean && sudo apt-get autoremove -y'
    `,
  );
}
