async function doWork() {
  const bashAndroidTmuxFileName = ".bash_syle_only_android_termux"
  const targetPath = path.join(BASE_HOMEDIR_LINUX, bashAndroidTmuxFileName); 

  console.log("  >> Register Android Termux Only profile", BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    "Only Android Termux - PLATFORM SPECIFIC TWEAKS", // key
    `. ~/${bashAndroidTmuxFileName}`
  );
  writeText(BASE_BASH_SYLE, textContent);

  console.log("  >> Installing Android Termux Only tweaks:", targetPath);
  writeText(
    targetPath,
    `
# chroot to set up /tmp /etc and other fds for linux
termux-chroot

# clear the console
clear
   `.trim()
  );
}
