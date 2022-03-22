async function _getPath() {
  try {
    let targetPath;

    // try it with D path
    // if it's not present, then try home dir in C drive
    targetPath = findFirstDirFromList([
      ['/mnt/d/', 'Documents'],
      [getWindowUserBaseDir(), 'Documents'],
    ]);

    if (targetPath) {
      targetPath = path.join(targetPath, 'WindowsPowerShell');
      await mkdir(targetPath);
      return path.join(targetPath, 'Microsoft.PowerShell_profile.ps1');
    }
  } catch (err) {
    console.log('  >> Failed to get the path for Powershell Profile', err);
  }

  return null;
}

async function doWork() {
  console.log('  >> Setting up Windows Powershell Profile');

  let targetPath = await _getPath();

  if (!targetPath) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  let content = readText(targetPath);

  // start with the required block
  content = appendTextBlock(
    content,
    'SY CUSTOM POWERSHELL CORE BLOCKS', // key
    trimLeftSpaces(`
      # tab autocomplete
      Set-PSReadlineKeyHandler -Key Tab -Function MenuComplete

      # keybindings
      # Import-Module PSReadLine
      # Get-PSReadLineKeyHandler
      # https://github.com/PowerShell/PSReadLine
      Set-PSReadLineKeyHandler -Key Ctrl+a -Function BeginningOfLine
      Set-PSReadLineKeyHandler -Key Ctrl+e -Function EndOfLine


      # Aliases
      New-Alias g git
      New-Alias ll ls
      New-Alias br cls
      New-Alias open explorer
      New-Alias d docker
    `),
  );

  // then add the optional block
  if (fs.existsSync('/mnt/d')) {
    content = appendTextBlock(
      content,
      'SY CUSTOM POWERSHELL OPTIONAL BLOCKS', // key
      trimLeftSpaces(`
        function gogit {
          Set-Location D:/git
        }
      `),
    );
  }

  console.log('    >> Update Powershell Profile', targetPath);
  writeText(targetPath, content);
}
