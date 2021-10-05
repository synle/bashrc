async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.fzf');

  console.log('  >> Download and installing fzf:', consoleLogColor4(targetPath));

  // clone it
  await execBashSilent(`
    rm -rf ${targetPath};
    git clone https://github.com/junegunn/fzf.git ${targetPath} &>/dev/null;
    `);

  await execBashSilent(`
    ${targetPath}/install --no-key-bindings --no-completion --no-update-rc &>/dev/null;
  `);

  console.log('    >> Register binary with bashrc', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'fzf - Fuzzy Find', // key
    `[ -f ~/.fzf.bash ] && . ~/.fzf.bash`,
  );
  writeText(BASE_BASH_SYLE, textContent);
}
