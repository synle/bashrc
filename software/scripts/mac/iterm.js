async function doWork() {
  console.log("  >> Installing Windows Only - Iterm Dracula Theme");

  if (!is_os_darwin_mac) {
    console.log("   >> Skipped - (Only Mac)");
    process.exit();
  }

  const targetPath = path.join(
    BASE_SY_CUSTOM_TWEAKS_DIR,
    "themes",
    "iterm.Dracula.itermcolors"
  );

  console.log("    >> Iterm Dracula Theme Path", targetPath);

  const url =
    "https://raw.githubusercontent.com/synle/ubuntu-setup/master/themes/mac/iterm.Dracula.itermcolors";
  await downloadFile(url, targetPath);
}
