/** Platform tweaks for Android Termux - registers termux-chroot and shell config. */
async function doWork() {
  registerPlatformTweaks(
    "Android Termux",
    code`
      # chroot to set up /tmp /etc and other fds for linux
      termux-chroot

      # clear the console
      clear
    `,
  );
}
