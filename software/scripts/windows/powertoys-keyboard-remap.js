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
  remapKeys: { inProcess: [{ originalKeys: '164', newRemapKeys: '163' }] },
  remapShortcuts: {
    global: [
      { originalKeys: '164;160;90', newRemapKeys: '163;89' },
      { originalKeys: '163;9', newRemapKeys: '165;9' },
      { originalKeys: '163;37', newRemapKeys: '36' },
      { originalKeys: '163;38', newRemapKeys: '33' },
      { originalKeys: '163;39', newRemapKeys: '35' },
      { originalKeys: '163;40', newRemapKeys: '34' },
      { originalKeys: '163;81', newRemapKeys: '18;115' },
      { originalKeys: '163;219', newRemapKeys: '165;37' },
      { originalKeys: '163;221', newRemapKeys: '165;39' },
      { originalKeys: '163;160;219', newRemapKeys: '162;33' },
      { originalKeys: '163;160;221', newRemapKeys: '17;34' },
      { originalKeys: '91;8', newRemapKeys: '17;8' },
      { originalKeys: '91;37', newRemapKeys: '162;37' },
      { originalKeys: '91;39', newRemapKeys: '162;39' },
      { originalKeys: '91;160;37', newRemapKeys: '162;160;37' },
      { originalKeys: '91;160;39', newRemapKeys: '162;160;39' },
    ],
    appSpecific: [
      { originalKeys: '164;160;73', newRemapKeys: '162;160;73', targetApp: 'brave.exe' },
      { originalKeys: '164;67', newRemapKeys: '165;67', targetApp: 'windowsterminal.exe' },
    ],
  },
};
