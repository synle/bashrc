async function doWork() {
  console.log('  >> Installing Powertoys Keyboard Config');

  // %LOCALAPPDATA%/Microsoft/PowerToys/Keyboard Manager
  const targetPath = path.join(getWindowAppDataLocalUserPath(), 'Microsoft/PowerToys/Keyboard Manager');
  console.log('    >> Configs', consoleLogColor4(targetPath));

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

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

const config = {
  remapKeys: { inProcess: [] },
  remapShortcuts: {
    global: [
      { originalKeys: '164;37', newRemapKeys: '36' },
      { originalKeys: '164;38', newRemapKeys: '33' },
      { originalKeys: '164;39', newRemapKeys: '35' },
      { originalKeys: '164;40', newRemapKeys: '34' },
      { originalKeys: '164;65', newRemapKeys: '17;65' },
      { originalKeys: '164;67', newRemapKeys: '17;67' },
      { originalKeys: '164;70', newRemapKeys: '17;70' },
      { originalKeys: '164;78', newRemapKeys: '17;78' },
      { originalKeys: '164;81', newRemapKeys: '18;115' },
      { originalKeys: '164;84', newRemapKeys: '17;84' },
      { originalKeys: '164;87', newRemapKeys: '17;87' },
      { originalKeys: '164;88', newRemapKeys: '17;88' },
      { originalKeys: '164;90', newRemapKeys: '17;90' },
      { originalKeys: '164;187', newRemapKeys: '162;187' },
      { originalKeys: '164;189', newRemapKeys: '162;189' },
      { originalKeys: '164;160;90', newRemapKeys: '17;89' },
      { originalKeys: '164;160;219', newRemapKeys: '17;33' },
      { originalKeys: '164;160;221', newRemapKeys: '17;34' },
      { originalKeys: '91;8', newRemapKeys: '17;8' },
      { originalKeys: '91;37', newRemapKeys: '17;37' },
      { originalKeys: '91;39', newRemapKeys: '17;39' },
      { originalKeys: '91;160;37', newRemapKeys: '17;16;37' },
      { originalKeys: '91;160;39', newRemapKeys: '17;16;39' },
    ],
    appSpecific: [
      { originalKeys: '164;48', newRemapKeys: '162;48', targetApp: 'brave.exe' },
      { originalKeys: '164;49', newRemapKeys: '162;49', targetApp: 'brave.exe' },
      { originalKeys: '164;50', newRemapKeys: '162;50', targetApp: 'brave.exe' },
      { originalKeys: '164;51', newRemapKeys: '162;51', targetApp: 'brave.exe' },
      { originalKeys: '164;52', newRemapKeys: '162;52', targetApp: 'brave.exe' },
      { originalKeys: '164;53', newRemapKeys: '162;53', targetApp: 'brave.exe' },
      { originalKeys: '164;54', newRemapKeys: '162;54', targetApp: 'brave.exe' },
      { originalKeys: '164;55', newRemapKeys: '162;55', targetApp: 'brave.exe' },
      { originalKeys: '164;56', newRemapKeys: '162;56', targetApp: 'brave.exe' },
      { originalKeys: '164;57', newRemapKeys: '162;57', targetApp: 'brave.exe' },
      { originalKeys: '164;82', newRemapKeys: '162;82', targetApp: 'brave.exe' },
      { originalKeys: '164;219', newRemapKeys: '18;37', targetApp: 'brave.exe' },
      { originalKeys: '164;221', newRemapKeys: '165;39', targetApp: 'brave.exe' },
      { originalKeys: '164;160;73', newRemapKeys: '17;16;73', targetApp: 'brave.exe' },
      { originalKeys: '164;160;78', newRemapKeys: '17;16;78', targetApp: 'brave.exe' },
      { originalKeys: '164;160;82', newRemapKeys: '162;160;82', targetApp: 'brave.exe' },
      { originalKeys: '164;67', newRemapKeys: '18;67', targetApp: 'windowsterminal.exe' },
      { originalKeys: '164;84', newRemapKeys: '18;84', targetApp: 'windowsterminal.exe' },
      { originalKeys: '164;86', newRemapKeys: '18;86', targetApp: 'windowsterminal.exe' },
      { originalKeys: '164;87', newRemapKeys: '18;87', targetApp: 'windowsterminal.exe' },
      { originalKeys: '164;160;219', newRemapKeys: '18;16;219', targetApp: 'windowsterminal.exe' },
      { originalKeys: '164;160;221', newRemapKeys: '18;16;221', targetApp: 'windowsterminal.exe' },
      { originalKeys: '91;67', newRemapKeys: '18;67', targetApp: 'windowsterminal.exe' },
      { originalKeys: '91;86', newRemapKeys: '18;86', targetApp: 'windowsterminal.exe' },
    ],
  },
};
