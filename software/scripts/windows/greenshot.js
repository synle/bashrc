/** Downloads and installs Greenshot screenshot tool for Windows. */
async function doWork() {
  log(">> Installing Windows Only - GreenShot");

  const targetPath = path.join(getWindowAppDataRoamingUserPath(), "Greenshot", "Greenshot.ini");
  log(">>> Configs", targetPath);

  exitIfPathNotFound(targetPath);
  await backupConfigFile(targetPath);

  const desktopPath = await getDesktopPath();
  exitIfPathNotFound(desktopPath);
  const outputFilePath = path.join(desktopPath, "_screenshots");
  await mkdir(outputFilePath);
  const outputFilePathWindows = toWindowsPath(outputFilePath);

  const outputFilePathLine = `OutputFilePath=${outputFilePathWindows}`;

  writeText(
    targetPath,
    `
      [Core]

      ; Output file path.
      ${outputFilePathLine}

      ; Disable update checks
      UpdateCheckInterval=0

      ; Hotkey for starting the region capture
      RegionHotkey=Alt + Shift + D4

      ; Which destinations? Possible options (more might be added by plugins) are: Editor, FileDefault, FileWithDialog, Clipboard, Printer, EMail, Picker
      Destinations=FileNoDialog,Clipboard
    `
      .replace(/[ ][ ]+/g, "")
      .trim(),
  );
}
