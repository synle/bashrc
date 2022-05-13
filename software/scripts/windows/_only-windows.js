async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.bash_syle_only_windows');

  console.log('  >> Register Windows Only profile', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'Only Windows - PLATFORM SPECIFIC TWEAKS', // key
    `. ${targetPath}`,
  );
  writeText(BASE_BASH_SYLE, textContent);

  console.log('  >> Installing Windows WSL Only tweaks:', consoleLogColor4(targetPath));
  writeText(
    targetPath,
    `
# do stuffs specific to wsl (windows sub linux system)
findResolvedPathForWsl1(){
  fullPathToFile=$(realpath "$1")
  node -e """
    const { exec } = require('child_process');
    const path = require('path');
    const winSep = path.win32.sep
    let fullPath = '$fullPathToFile';
    if(fullPath.indexOf('/mnt/') !== 0){
      fullPath = '/mnt/z' + fullPath
    }
    fullPath = fullPath.replace(/\\/mnt\\/[a-z]/, _convert1);
    fullPath = fullPath.split(path.sep).join(winSep)
    console.log(fullPath);
    function _convert1(match, matchIdx, fullPath){
      const driveLetter = match[match.length - 1].toUpperCase();
      return driveLetter + ':';
    }
  """
}

# To be run in WSL terminals to extract path envs
function exportPathEnvs(){
  echo $PATH | node -e """
    let data = '';

    process.openStdin().addListener('data', (d) => {
      data += d.toString();
    });

    process.openStdin().addListener('end', (d) => {
      const output = data.split(':').filter(s => s.includes('/mnt/')).map(s => {
        s = s.replace('/mnt/c/', 'C:/');
        s = s.replace('/mnt/d/', 'D:/');

        return s
      }).join('\n');

      console.log(output);

      process.exit();
    });
  """
}

open(){
  echo "$@"
  explorer.exe "$@"
}

cmd(){
  cmd.exe '/C' "$@"
}

alias adb='adb.exe'
alias fastboot='fastboot.exe'
alias update='sudo apt-get update -y; sudo apt-get upgrade -y; sudo apt-get autoclean; sudo apt-get clean; sudo apt-get autoremove'
alias find='fdfind' # alias for fd
  `.trim(),
  );
}
