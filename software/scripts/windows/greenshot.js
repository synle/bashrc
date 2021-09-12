async function doWork() {
  console.log('  >> Installing Windows Only - GreenShot');

  const targetPath = path.join(getWindowAppDataRoamingUserPath(), 'Greenshot', 'Greenshot.ini');
  console.log('    >> Configs', targetPath);
  writeText(
    targetPath,
    `
      [Core]

      ; TODO: not used yet
      ; Output file path.
      ; OutputFilePath=D:\_desktop

      ; Hotkey for starting the region capture
      RegionHotkey=Alt + Shift + D4

      ; Which destinations? Possible options (more might be added by plugins) are: Editor, FileDefault, FileWithDialog, Clipboard, Printer, EMail, Picker
      Destinations=FileNoDialog,Clipboard
    `
      .replace(/[ ][ ]+/g, '')
      .trim(),
  );
}
