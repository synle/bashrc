async function doWork() {
  console.log('  >> Installing Powertoys Keyboard Config');

  // %LOCALAPPDATA%/Microsoft/PowerToys/Keyboard Manager
  const targetPath = path.join(getWindowAppDataLocalUserPath(), 'Microsoft/PowerToys/Keyboard Manager');
  console.log('    >> Configs', consoleLogColor4(targetPath));

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  writeText(path.join(targetPath, 'default.json'), JSON.stringify(config));
}

const config = {
  remapKeys: { inProcess: [] },
  remapShortcuts: {
    global: [
      { originalKeys: '164;8', newRemapKeys: '162;8' },
      { originalKeys: '164;37', newRemapKeys: '36' },
      { originalKeys: '164;38', newRemapKeys: '33' },
      { originalKeys: '164;39', newRemapKeys: '35' },
      { originalKeys: '164;40', newRemapKeys: '34' },
      { originalKeys: '164;48', newRemapKeys: '162;48' },
      { originalKeys: '164;49', newRemapKeys: '162;49' },
      { originalKeys: '164;50', newRemapKeys: '162;50' },
      { originalKeys: '164;51', newRemapKeys: '162;51' },
      { originalKeys: '164;52', newRemapKeys: '162;52' },
      { originalKeys: '164;53', newRemapKeys: '162;53' },
      { originalKeys: '164;54', newRemapKeys: '162;54' },
      { originalKeys: '164;55', newRemapKeys: '162;55' },
      { originalKeys: '164;56', newRemapKeys: '162;56' },
      { originalKeys: '164;57', newRemapKeys: '162;57' },
      { originalKeys: '164;65', newRemapKeys: '162;65' },
      { originalKeys: '164;67', newRemapKeys: '162;67' },
      { originalKeys: '164;70', newRemapKeys: '162;70' },
      { originalKeys: '164;78', newRemapKeys: '162;78' },
      { originalKeys: '164;79', newRemapKeys: '162;79' },
      { originalKeys: '164;80', newRemapKeys: '162;80' },
      { originalKeys: '164;84', newRemapKeys: '162;84' },
      { originalKeys: '164;86', newRemapKeys: '162;86' },
      { originalKeys: '164;87', newRemapKeys: '162;87' },
      { originalKeys: '164;88', newRemapKeys: '162;88' },
      { originalKeys: '164;90', newRemapKeys: '162;90' },
      { originalKeys: '164;187', newRemapKeys: '162;187' },
      { originalKeys: '164;189', newRemapKeys: '162;189' },
      { originalKeys: '164;160;70', newRemapKeys: '162;160;70' },
      { originalKeys: '164;160;78', newRemapKeys: '162;160;78' },
      { originalKeys: '164;160;79', newRemapKeys: '162;160;79' },
      { originalKeys: '164;160;80', newRemapKeys: '162;160;80' },
      { originalKeys: '164;160;90', newRemapKeys: '162;89' },
      { originalKeys: '164;160;219', newRemapKeys: '162;33' },
      { originalKeys: '164;160;221', newRemapKeys: '162;34' },
    ],
    appSpecific: [
      { originalKeys: '164;219', newRemapKeys: '165;37', targetApp: 'brave.exe' },
      { originalKeys: '164;221', newRemapKeys: '165;39', targetApp: 'brave.exe' },
      { originalKeys: '164;160;73', newRemapKeys: '162;160;73', targetApp: 'brave.exe' },
      { originalKeys: '164;67', newRemapKeys: '165;67', targetApp: 'windowsterminal.exe' },
    ],
  },
};
