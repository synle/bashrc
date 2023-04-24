async function doWork() {
  console.log('  >> Installing Windows Only - Iterm Dracula Theme');

  if (!is_os_darwin_mac) {
    console.log('    >> Skipped - mac only');
    return process.exit();
  }

  let baseTargetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'mac');
  let targetPath;

  targetPath = path.join(baseTargetPath, 'iterm.Dracula.itermcolors');
  console.log('    >> Iterm Dracula Theme Path', consoleLogColor4(targetPath));
  writeText(targetPath, await fetchUrlAsString('software/scripts/mac/iterm-color-scheme-dracula.xml'));

  targetPath = path.join(baseTargetPath, 'iterm.itermkeymap');
  console.log('    >> Iterm Keymap', consoleLogColor4(targetPath));
  writeText(targetPath, await fetchUrlAsString('software/scripts/mac/iterm-keymapping.json'));

  targetPath = findDirSingle(getOsxApplicationSupportCodeUserPath(), /iTerm[ ]*[a-z0-9]*/i);

  if (fs.existsSync(targetPath)) {
    targetPath = path.join(targetPath, 'Scripts/AutoLaunch');
    await mkdir(targetPath);
    targetPath = path.join(targetPath, 'switch_automatic.py');

    console.log('    >> Auto switch color scheme', consoleLogColor4(targetPath));
    writeText(targetPath, await fetchUrlAsString('software/scripts/mac/iterm-auto-theme.py'));
  }
}
