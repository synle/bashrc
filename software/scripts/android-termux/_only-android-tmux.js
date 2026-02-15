async function doWork() {
  const bashAndroidTmuxFileName = '.bash_syle_only_android_termux';

  registerPlatformTweaks(
    'Only Android Termux',
    bashAndroidTmuxFileName,
    `
# chroot to set up /tmp /etc and other fds for linux
termux-chroot

# clear the console
clear
   `.trim(),
    `. ~/${bashAndroidTmuxFileName}`,
  );
}
