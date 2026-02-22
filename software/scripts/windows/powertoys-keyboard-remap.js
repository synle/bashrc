async function doWork() {
  console.log('  >> Installing Powertoys Keyboard Config');

  // %LOCALAPPDATA%/Microsoft/PowerToys/Keyboard Manager
  const targetPath = path.join(getWindowAppDataLocalUserPath(), 'Microsoft/PowerToys/Keyboard Manager');
  console.log('    >> Configs', consoleLogColor4(targetPath));

  exitIfPathNotFound(targetPath);

  // read the file
  const config = await fetchUrlAsJson('software/scripts/windows/powertoys-keyboard-remap.jsonc');

  // clone the browser related keys such as brave or chrome
  const newAppSpecificKeys = [];
  const newBrowserKeys = new Set();
  for (const appSpecific of config.remapShortcuts.appSpecific) {
    const { originalKeys, newRemapKeys, targetApp } = appSpecific;
    switch (targetApp) {
      case 'brave.exe':
      case 'chrome.exe':
        newBrowserKeys.add(JSON.stringify({ originalKeys, newRemapKeys }));
        break;
      default:
        newAppSpecificKeys.push({ originalKeys, newRemapKeys, targetApp });
        break;
    }
  }

  for (const newBrowserKey of newBrowserKeys) {
    const { originalKeys, newRemapKeys } = JSON.parse(newBrowserKey);

    newAppSpecificKeys.push({ originalKeys, newRemapKeys, targetApp: 'brave.exe' });
    newAppSpecificKeys.push({ originalKeys, newRemapKeys, targetApp: 'chrome.exe' });
  }

  config.remapShortcuts.appSpecific = newAppSpecificKeys;

  writeText(path.join(targetPath, 'default.json'), JSON.stringify(config));
}
