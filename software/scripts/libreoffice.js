/** * Disables the LibreOffice splash screen on Chrome OS and Arch Linux. */
async function doWork() {
  let targetPath = "/etc/libreoffice";

  log("  >> Install libreoffice configs:", targetPath);

  if (!is_os_chromeos && !is_os_arch_linux) {
    log("    >> Skipped : Not Applicable");
    return process.exit();
  }

  exitIfPathNotFound(targetPath);

  targetPath = path.join(targetPath, "sofficerc");
  log("    >> Update Configs:", targetPath);

  let newContent = readText(targetPath);

  // disable splash screen
  // https://www.howtogeek.com/287367/how-to-disable-libreoffices-startup-splash-screen-on-windows-and-linux
  newContent = newContent.replace(/Logo=[0-9]/, "").trim();
  newContent += `\nLogo=0`;
  newContent = newContent.replace(/[\n][\n]+/, "\n");

  writeText(targetPath, newContent);
}
