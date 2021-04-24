async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_only_android_termux");

  console.log("  >> Register Android Termux Only profile", BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    "Only Android Termux - PLATFORM SPECIFIC TWEAKS", // key
    `. ${targetPath}`
  );
  writeText(BASE_BASH_SYLE, textContent);

  console.log("  >> Installing Android Termux Only tweaks:", targetPath);
  writeText(
    targetPath,
    `
termux-chroot

# clear the console
clear
   `.trim()
  );
}
