async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.synle-make-component');

  console.log('  >> Download and installing synle-make-component:', consoleLogColor4(targetPath));

  console.log('    >> Cloning and building', consoleLogColor4(targetPath));
  await execBashSilent(`
    rm -rf "${targetPath}"
    git clone --depth 1 -b master https://github.com/synle/make-component.git "${targetPath}"
  `);

  await execBashSilent(`npm i && npm run build`, {
    cwd: targetPath,
  });

  console.log('    >> Register binary with bashrc', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'Sy Make Component', // key
    trimLeftSpaces(`
      [ -f ${targetPath}/setup.sh ] && . ${targetPath}/setup.sh

      ## fzf alias for synle-make-component
      getMakeComponentOptions(){
        make-help
      }

      fuzzyMakeComponent(){
        makeComponentCommand=$(( \
        getMakeComponentOptions \
        ) | sed '/^\s*$/d' | uniq | fzf)
        echo "$makeComponentCommand"
        $makeComponentCommand
      }
    `),
  );
  writeText(BASE_BASH_SYLE, textContent);
}
