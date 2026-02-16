async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.bashrc');
  let bashrcTextContent = readText(targetPath);

  console.log('  >> Updating .bashrc initial setup', consoleLogColor4(targetPath));

  // add tweaks...
  bashrcTextContent = appendTextBlock(
    bashrcTextContent,
    'Sy bashrc entry point', // key
    trimLeftSpaces(`
          [ -s ~/.bash_syle ] && . ~/.bash_syle
        `),
  );

  // source all .bash_* files in home folder (excluding known non-config files)
  const excludedBashFiles = ['.bash_syle', '.bash_history', '.bash_profile', '.bash_sessions'];
  try {
    const homeFiles = fs.readdirSync(BASE_HOMEDIR_LINUX);
    const bashFiles = homeFiles
      .filter((f) => f.startsWith('.bash_'))
      .filter((f) => !excludedBashFiles.some((excluded) => f.startsWith(excluded)));

    for (const bashFile of bashFiles) {
      const fullPath = path.join(BASE_HOMEDIR_LINUX, bashFile);
      console.log('  >> Sourcing bash file', consoleLogColor4(fullPath));
      bashrcTextContent = appendTextBlock(bashrcTextContent, `${bashFile} entry point`, `[ -s ${fullPath} ] && . ${fullPath}`);
    }
  } catch (err) {}

  // write if there are change
  writeText(targetPath, bashrcTextContent);

  // wipe out the bash syle
  console.log('  >> Wiping out the old .bash_syle', BASE_BASH_SYLE);
  writeText(BASE_BASH_SYLE, '');

  // bootstrap Mac Darwin OSX .bash_profile
  if (is_os_darwin_mac) {
    console.log('  >> Bootstrapping Mac Darwin OSX .bash_profile');
    const bashProfilePath = path.join(BASE_HOMEDIR_LINUX, '.bash_profile');
    let bashProfileDarwinMacTextContent = readText(bashProfilePath);
    bashProfileDarwinMacTextContent = appendTextBlock(
      bashProfileDarwinMacTextContent,
      'Sy bashrc OSX entrypoint',
      '[ -s ~/.bashrc ] && . ~/.bashrc',
    );
    writeText(bashProfilePath, bashProfileDarwinMacTextContent);
  }
}
