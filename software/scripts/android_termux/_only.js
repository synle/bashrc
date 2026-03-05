/** * Gate check that exits early if the current environment is not Android Termux. */
async function doWork() {
  registerPlatformTweaks(
    "Android Termux",
    trimLeftSpaces(`
      # chroot to set up /tmp /etc and other fds for linux
      termux-chroot

      # clear the console
      clear
    `).trim(),
  );
}
